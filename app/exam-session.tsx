import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  getNativeStoredItem,
  removeNativeStoredItem,
  setNativeStoredItem,
} from '@/lib/native-key-value-storage';
import {
  analyzeVideoSummary,
  buildDetectorObservationSummary,
  buildSuspiciousEvidenceTemplate,
  createDetectorSession,
  createEmptyAggregateMetrics,
  deleteDetectorSession,
  detectorLabelToAnalysisLabel,
  detectorScoreToRiskLevel,
  endProctoringSession,
  ensureActiveProctoringSession,
  insertSuspiciousEvent,
  mergeAggregateMetrics,
  syncAnalysisSessionMetrics,
  updateSuspiciousEventEvidence,
  uploadSuspiciousClipSegment,
  type ProctoringSessionHandle,
  type SuspiciousEventEvidence,
} from '@/lib/proctoring';
import {
  fetchStudentExamSessionData,
  submitStudentExamAnswers,
  type StudentExamSessionData,
} from '@/lib/student-exam';

const EMPTY_QUESTIONS: StudentExamSessionData['questions'] = [];
const BEEP_SOUND_ASSET = require('../assets/audio/beep.wav');
const CLIP_SECONDS = 5;
const CLIP_READY_MIN_BYTES = 6144;
const DELAYED_DETECTOR_ALERT_COOLDOWN_MS = 4_000;
const DELAYED_DETECTOR_ALERT_SOUND_MS = 1_800;
const EVIDENCE_LEAD_SECONDS = 2;
const EVIDENCE_TRAIL_SECONDS = 2;
const SEGMENT_PRUNE_WINDOW_SECONDS = 32;
const PROCTORING_CLIP_CACHE_DIR = 'proctoring-live-clips';
const APP_EXIT_STORAGE_KEY = 'chetect.exam.appExitMarker';
const APP_EXIT_FLAG_THRESHOLD_MS = 5_000;
const APP_EXIT_FORCE_SUBMIT_THRESHOLD_MS = 10_000;
const EVIDENCE_UPLOAD_BLOCKED_MESSAGE =
  'Suspicious clip evidence upload is blocked by Supabase Storage policy until the latest suspiciousVideos migration is applied.';
const EVIDENCE_UPLOAD_WARNING_MESSAGE =
  'Live analysis is running. Suspicious events are still recorded, but clip evidence upload is blocked by Supabase Storage policy. Apply the latest suspiciousVideos storage policy migration.';

type LocalClipSegment = {
  durationSeconds: number;
  endedAtIso: string;
  path?: string;
  publicUrl?: string | null;
  startedAtIso: string;
  uri: string;
};

type PendingTrailingEvidence = {
  eventId: string;
  evidence: SuspiciousEventEvidence;
  missingLeadCoverage: boolean;
  targetWindowEndMs: number;
};

type AppExitMarker = {
  examId: string;
  startedAtIso: string;
  startedAtMs: number;
};

type LiveDetectorSummary = Awaited<ReturnType<typeof analyzeVideoSummary>>;
type LiveDetectorAlert = LiveDetectorSummary['alerts'][number];
type LiveDetectorEvent = LiveDetectorSummary['events'][number];
type LiveDetectorLabel = ReturnType<typeof detectorLabelToAnalysisLabel>;

function normalizeDetectorSeverity(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isMildHeadPoseOrGazeReason(reason: string) {
  const normalized = reason.trim().toLowerCase();
  return /head tilt|head yaw|head pitch|head roll|tilted to the (left|right)|eyes? rolled to the (left|right|up|down)|gaze|looking (left|right|up|down)|look(?:ing)? away|sideways|off-screen/.test(
    normalized
  );
}

function toFiniteDetectorSeconds(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function isPersistentMildHeadPoseOrGazeEvent(event: LiveDetectorEvent) {
  const severity = normalizeDetectorSeverity(event.severity);
  const score = Number(event.max_score ?? 0);
  const durationSeconds = toFiniteDetectorSeconds(event.duration_seconds);

  if (score >= 92) {
    return true;
  }

  if ((severity === 'critical' || severity === 'high') && score >= 80 && durationSeconds >= 1.5) {
    return true;
  }

  return score >= 85 && durationSeconds >= 1.8;
}

function isPersistentMildHeadPoseOrGazeAlert(alert: LiveDetectorAlert) {
  const severity = normalizeDetectorSeverity(alert.severity);
  const durationSeconds = toFiniteDetectorSeconds(alert.duration_seconds);

  return (severity === 'critical' || severity === 'high') && durationSeconds >= 1.2;
}

function doDetectorWindowsOverlap(
  startASeconds: number,
  endASeconds: number,
  startBSeconds: number,
  endBSeconds: number
) {
  return Math.min(endASeconds, endBSeconds) - Math.max(startASeconds, startBSeconds) >= 0.12;
}

function isDetectorAlertActionable(alert: LiveDetectorAlert) {
  const severity = normalizeDetectorSeverity(alert.severity);
  const label = detectorLabelToAnalysisLabel(alert.label);
  if (label === 'NO_FACE') {
    return true;
  }

  if (isMildHeadPoseOrGazeReason(String(alert.reason ?? ''))) {
    return isPersistentMildHeadPoseOrGazeAlert(alert);
  }

  if (label === 'SUSPICIOUS' || label === 'CAUTION') {
    return true;
  }

  if (severity !== 'high' && severity !== 'critical') {
    return false;
  }

  return true;
}

function doesDetectorEventMatchAlert(event: LiveDetectorEvent, alert: LiveDetectorAlert) {
  return doDetectorWindowsOverlap(
    Number(event.start_timestamp_seconds),
    Number(event.end_timestamp_seconds),
    Number(alert.start_timestamp_seconds),
    Number(alert.end_timestamp_seconds)
  );
}

function isDetectorEventActionable(event: LiveDetectorEvent) {
  const label = detectorLabelToAnalysisLabel(event.label);
  const severity = normalizeDetectorSeverity(event.severity);
  const score = Number(event.max_score ?? 0);
  if (label === 'NO_FACE') {
    return true;
  }

  if (label === 'NORMAL') {
    return false;
  }

  if (isMildHeadPoseOrGazeReason(String(event.reason ?? ''))) {
    return isPersistentMildHeadPoseOrGazeEvent(event);
  }

  if (label === 'CAUTION') {
    return severity === 'critical' || severity === 'high' || severity === 'medium' || score >= 45;
  }

  return severity === 'critical' || severity === 'high' || score >= 75;
}

function getSyntheticEventScoreFloor(label: LiveDetectorLabel) {
  if (label === 'NO_FACE') {
    return 85;
  }

  if (label === 'SUSPICIOUS') {
    return 80;
  }

  if (label === 'CAUTION') {
    return 60;
  }

  return 0;
}

function getSyntheticEventReason(summary: LiveDetectorSummary, label: LiveDetectorLabel) {
  const observationSummary = buildDetectorObservationSummary(summary, 3, {
    includeAlertReasons: true,
    includeKeyFrameObservations: true,
  });

  if (observationSummary) {
    return observationSummary;
  }

  if (label === 'NO_FACE') {
    return 'Face is not visible to the camera.';
  }

  if (label === 'CAUTION') {
    return 'Monitoring caution detected in the latest camera window.';
  }

  return 'Suspicious behavior detected in the latest camera window.';
}

function createSyntheticActionableEvent(
  summary: LiveDetectorSummary,
  label: LiveDetectorLabel
): LiveDetectorEvent {
  const durationSeconds = Math.max(
    0.1,
    toFiniteDetectorSeconds(summary.duration_seconds) || CLIP_SECONDS
  );
  const framesProcessed = Math.max(0, Math.trunc(Number(summary.frames_processed ?? 0)));
  const framesSampled = Math.max(0, Math.trunc(Number(summary.frames_sampled ?? 0)));
  const rawMaxScore = Number(summary.max_score ?? 0);
  const maxScore = Math.max(
    getSyntheticEventScoreFloor(label),
    Number.isFinite(rawMaxScore) ? rawMaxScore : 0
  );

  return {
    duration_seconds: durationSeconds,
    end_frame_index: Math.max(0, framesProcessed - 1),
    end_timestamp_seconds: durationSeconds,
    frame_count: Math.max(1, framesSampled || framesProcessed || 1),
    label,
    max_score: maxScore,
    reason: getSyntheticEventReason(summary, label),
    severity: label === 'NO_FACE' || label === 'SUSPICIOUS' ? 'high' : 'medium',
    signal_code: label === 'NO_FACE' ? 'NO_FACE' : label,
    start_frame_index: 0,
    start_timestamp_seconds: 0,
  };
}

function shouldCreateSyntheticActionableEvent(
  summary: LiveDetectorSummary,
  label: LiveDetectorLabel,
  actionableCount: number
) {
  if (actionableCount > 0) {
    return false;
  }

  const hasAnalyzedFrames = Number(summary.frames_sampled ?? 0) > 0 || Number(summary.frames_processed ?? 0) > 0;
  if (!hasAnalyzedFrames) {
    return false;
  }

  if (label === 'NO_FACE' || label === 'SUSPICIOUS') {
    return true;
  }

  return label === 'CAUTION' && Number(summary.max_score ?? 0) >= 60;
}

function doesSummaryOnlyContainMildHeadPoseOrGazeSignals(summary: LiveDetectorSummary) {
  const reasons = [...(summary.alerts ?? []), ...(summary.events ?? [])]
    .map((signal) => String(signal.reason ?? '').trim())
    .filter(Boolean);

  return reasons.length > 0 && reasons.every(isMildHeadPoseOrGazeReason);
}

function buildActionableDetectorSummary(summary: LiveDetectorSummary): LiveDetectorSummary {
  let actionableAlerts: LiveDetectorAlert[] = [];
  let actionableEvents: LiveDetectorEvent[] = [];
  if ((summary.alerts ?? []).length > 0) {
    const usedEventIndexes = new Set<number>();
    const matchedSignals = (summary.alerts ?? [])
      .map((alert) => {
        const matchedEvent = summary.events
          .map((event, index) => ({
            event,
            index,
          }))
          .filter(({ event, index }) => !usedEventIndexes.has(index) && doesDetectorEventMatchAlert(event, alert))
          .sort((left, right) => {
            const rightScore = Number(right.event.max_score ?? 0);
            const leftScore = Number(left.event.max_score ?? 0);
            if (rightScore !== leftScore) {
              return rightScore - leftScore;
            }

            const rightDuration = Number(right.event.duration_seconds ?? 0);
            const leftDuration = Number(left.event.duration_seconds ?? 0);
            return rightDuration - leftDuration;
          })[0];

        if (matchedEvent) {
          if (!isDetectorEventActionable(matchedEvent.event)) {
            return null;
          }

          usedEventIndexes.add(matchedEvent.index);
          return {
            alert,
            event: matchedEvent.event,
          };
        }

        if (!isDetectorAlertActionable(alert)) {
          return null;
        }

        return {
          alert,
          event: null,
        };
      })
      .filter(
        (
          signal
        ): signal is {
          alert: LiveDetectorAlert;
          event: LiveDetectorEvent | null;
        } => Boolean(signal)
      );

    actionableAlerts = matchedSignals.map((signal) => signal.alert);
    actionableEvents = matchedSignals
      .map((signal) => signal.event)
      .filter((event): event is LiveDetectorEvent => Boolean(event));
  } else {
    actionableEvents = summary.events.filter(isDetectorEventActionable);
  }

  const normalizedFinalLabel = detectorLabelToAnalysisLabel(summary.final_label);
  if (actionableAlerts.length > 0 && actionableEvents.length === 0) {
    actionableEvents = [
      createSyntheticActionableEvent(
        summary,
        normalizedFinalLabel === 'NORMAL' ? 'SUSPICIOUS' : normalizedFinalLabel
      ),
    ];
  }

  let actionableCount = Math.max(actionableAlerts.length, actionableEvents.length);
  if (shouldCreateSyntheticActionableEvent(summary, normalizedFinalLabel, actionableCount)) {
    actionableEvents = [createSyntheticActionableEvent(summary, normalizedFinalLabel)];
    actionableCount = 1;
  }

  const hasOnlyMildHeadPoseOrGazeSignals = doesSummaryOnlyContainMildHeadPoseOrGazeSignals(summary);
  const downgradedFinalLabel =
    actionableCount === 0 &&
    normalizedFinalLabel === 'SUSPICIOUS' &&
    (Number(summary.max_score ?? 0) < 75 || hasOnlyMildHeadPoseOrGazeSignals)
      ? 'CAUTION'
      : summary.final_label;

  return {
    ...summary,
    alerts: actionableAlerts,
    events: actionableEvents,
    final_label: downgradedFinalLabel,
    max_score: Math.max(
      Number(summary.max_score ?? 0),
      ...actionableEvents.map((event) => Number(event.max_score ?? 0))
    ),
    suspicious_event_count: actionableCount,
  };
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDurationSeconds(durationMs: number) {
  return `${Math.max(0, durationMs / 1000).toFixed(1)}s`;
}

function parseStoredAppExitMarker(raw: string | null): AppExitMarker | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<AppExitMarker>;
    const examId = String(value.examId ?? '').trim();
    const startedAtIso = String(value.startedAtIso ?? '').trim();
    const startedAtMs = Number(value.startedAtMs);

    if (!examId || !startedAtIso || !Number.isFinite(startedAtMs)) {
      return null;
    }

    return {
      examId,
      startedAtIso,
      startedAtMs,
    };
  } catch {
    return null;
  }
}

async function readStoredAppExitMarker() {
  if (Platform.OS === 'web') {
    try {
      return parseStoredAppExitMarker(globalThis.localStorage?.getItem(APP_EXIT_STORAGE_KEY) ?? null);
    } catch {
      return null;
    }
  }

  return parseStoredAppExitMarker(await getNativeStoredItem(APP_EXIT_STORAGE_KEY));
}

async function writeStoredAppExitMarker(marker: AppExitMarker) {
  const payload = JSON.stringify(marker);

  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(APP_EXIT_STORAGE_KEY, payload);
    } catch {
      // Restricted browsers may block storage; app-state refs still cover the current process.
    }
    return;
  }

  await setNativeStoredItem(APP_EXIT_STORAGE_KEY, payload);
}

async function clearStoredAppExitMarker() {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(APP_EXIT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures in restricted browser contexts.
    }
    return;
  }

  await removeNativeStoredItem(APP_EXIT_STORAGE_KEY);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveRemainingSeconds(scheduledEndIso: string) {
  const endTimestamp = new Date(scheduledEndIso).getTime();
  if (Number.isNaN(endTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((endTimestamp - Date.now()) / 1000));
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

type WaitForRecordedClipReadyOptions = {
  minBytes?: number;
  pollMs?: number;
  stableReads?: number;
  timeoutMs?: number;
};

async function waitForRecordedClipReady(
  clipUri: string,
  options: WaitForRecordedClipReadyOptions = {}
) {
  if (Platform.OS === 'web') {
    return;
  }

  const minBytes = Math.max(2048, Math.trunc(options.minBytes ?? 6144));
  const pollMs = Math.max(80, Math.trunc(options.pollMs ?? 150));
  const stableReads = Math.max(2, Math.trunc(options.stableReads ?? 3));
  const timeoutMs = Math.max(1200, Math.trunc(options.timeoutMs ?? 6000));
  const deadlineMs = Date.now() + timeoutMs;

  let lastObservedSize = -1;
  let stableReadCount = 0;
  let lastFsErrorMessage = '';

  while (Date.now() < deadlineMs) {
    try {
      const info = await FileSystem.getInfoAsync(clipUri);
      if (
        info.exists &&
        !info.isDirectory &&
        typeof info.size === 'number' &&
        Number.isFinite(info.size) &&
        info.size >= minBytes
      ) {
        if (info.size === lastObservedSize) {
          stableReadCount += 1;
        } else {
          lastObservedSize = info.size;
          stableReadCount = 1;
        }

        if (stableReadCount >= stableReads) {
          return;
        }
      } else {
        lastObservedSize = -1;
        stableReadCount = 0;
      }
    } catch (error) {
      lastObservedSize = -1;
      stableReadCount = 0;
      lastFsErrorMessage = error instanceof Error ? error.message : '';
    }

    await sleep(pollMs);
  }

  const fsDetail = lastFsErrorMessage ? ` (${lastFsErrorMessage})` : '';
  throw new Error(`Recorded clip is not finalized yet. Please retry${fsDetail}.`);
}

function isLikelyUnfinalizedClipError(message: string) {
  return /not finalized|moov atom|valid video|could not read any frames/i.test(message);
}

async function waitForClipFinalizationRetryWindow(clipUri: string) {
  try {
    await waitForRecordedClipReady(clipUri, {
      minBytes: CLIP_READY_MIN_BYTES,
      pollMs: 170,
      stableReads: 3,
      timeoutMs: 4200,
    });
  } catch {
    // Best effort: continue and let detector retry surface the final result.
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function deriveClipExtensionFromUri(clipUri: string) {
  const clipUriWithoutQuery = String(clipUri ?? '').split('?')[0] ?? '';
  const dotIndexInUri = clipUriWithoutQuery.lastIndexOf('.');
  const extensionFromUri =
    dotIndexInUri >= 0 ? clipUriWithoutQuery.slice(dotIndexInUri).trim().toLowerCase() : '';

  if (['.mp4', '.mov', '.webm', '.avi', '.3gp', '.3g2'].includes(extensionFromUri)) {
    return extensionFromUri;
  }

  return '.mp4';
}

function normalizeClipUri(clipUri: string | null | undefined) {
  return String(clipUri ?? '').split('?')[0]?.trim() ?? '';
}

function toDirectoryUri(rootUri: string) {
  return rootUri.endsWith('/') ? rootUri : `${rootUri}/`;
}

function getProctoringClipCacheRootUri() {
  const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  if (!cacheRoot) {
    return '';
  }

  return `${toDirectoryUri(cacheRoot)}${PROCTORING_CLIP_CACHE_DIR}/`;
}

function isManagedProctoringClipUri(clipUri: string) {
  const cacheRoot = getProctoringClipCacheRootUri();
  const normalizedClipUri = normalizeClipUri(clipUri);
  return Boolean(cacheRoot && normalizedClipUri && normalizedClipUri.startsWith(cacheRoot));
}

async function ensureProctoringClipCacheRoot() {
  const cacheRoot = getProctoringClipCacheRootUri();
  if (!cacheRoot) {
    return '';
  }

  try {
    await FileSystem.makeDirectoryAsync(cacheRoot, {
      intermediates: true,
    });
  } catch {
    // If folder creation fails, recording can still continue using the original URI.
  }

  return cacheRoot;
}

async function deleteClipFileIfPresent(clipUri: string) {
  const normalizedClipUri = normalizeClipUri(clipUri);
  if (!normalizedClipUri) {
    return;
  }

  try {
    await FileSystem.deleteAsync(normalizedClipUri, {
      idempotent: true,
    });
  } catch {
    // Best effort cleanup for temp clips.
  }
}

async function clearManagedProctoringClipCache(options: { keepUris?: string[] } = {}) {
  const cacheRoot = await ensureProctoringClipCacheRoot();
  if (!cacheRoot) {
    return;
  }

  const keepUris = new Set(
    (options.keepUris ?? [])
      .map((clipUri) => normalizeClipUri(clipUri))
      .filter((clipUri) => clipUri.startsWith(cacheRoot))
  );

  try {
    const entries = await FileSystem.readDirectoryAsync(cacheRoot);
    await Promise.all(
      entries.map(async (entryName) => {
        const entryUri = `${cacheRoot}${entryName}`;
        if (keepUris.has(entryUri)) {
          return;
        }

        await deleteClipFileIfPresent(entryUri);
      })
    );
  } catch {
    // Best effort cleanup for temp clips.
  }
}

async function copyClipIntoManagedCache(clipUri: string) {
  const normalizedClipUri = normalizeClipUri(clipUri);
  if (!normalizedClipUri || Platform.OS === 'web') {
    return normalizedClipUri;
  }

  const cacheRoot = await ensureProctoringClipCacheRoot();
  if (!cacheRoot) {
    return normalizedClipUri;
  }

  const extension = deriveClipExtensionFromUri(normalizedClipUri);
  const copiedClipUri = `${cacheRoot}segment-${Date.now()}-${randomId()}${extension}`;

  await FileSystem.copyAsync({
    from: normalizedClipUri,
    to: copiedClipUri,
  });

  await waitForRecordedClipReady(copiedClipUri, {
    minBytes: CLIP_READY_MIN_BYTES,
    pollMs: 130,
    stableReads: 2,
    timeoutMs: 2600,
  });

  if (normalizedClipUri !== copiedClipUri) {
    await deleteClipFileIfPresent(normalizedClipUri);
  }

  return copiedClipUri;
}

function toTimestampMs(isoValue: string) {
  const timestamp = new Date(isoValue).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isSegmentOverlappingWindow(
  segment: LocalClipSegment,
  windowStartMs: number,
  windowEndMs: number
) {
  const segmentStartMs = toTimestampMs(segment.startedAtIso);
  const segmentEndMs = toTimestampMs(segment.endedAtIso);
  if (segmentStartMs === null || segmentEndMs === null) {
    return false;
  }

  return segmentEndMs > windowStartMs && segmentStartMs < windowEndMs;
}

function appendEvidenceSegmentIfMissing(
  evidence: SuspiciousEventEvidence,
  segment: SuspiciousEventEvidence['segments'][number]
) {
  const exists = evidence.segments.some(
    (saved) =>
      saved.path === segment.path ||
      (saved.startedAtIso === segment.startedAtIso && saved.endedAtIso === segment.endedAtIso)
  );

  if (exists) {
    return;
  }

  evidence.segments.push(segment);
  evidence.segments.sort((left, right) => {
    const leftStartMs = toTimestampMs(left.startedAtIso) ?? 0;
    const rightStartMs = toTimestampMs(right.startedAtIso) ?? 0;
    return leftStartMs - rightStartMs;
  });
}

function deriveDetectorSampling(monitoringMode: StudentExamSessionData['monitoringMode']) {
  void monitoringMode;
  // Match the detector defaults so live app analysis stays comparable to direct API checks.
  return {
    maxFrames: 30,
    sampleEveryNFrames: 10,
  };
}

function toErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return fallbackMessage;
}

function isLikelyTransientNetworkFailure(message: string) {
  const normalized = message.toLowerCase();
  return /unable to reach detector service|network request failed|failed to fetch|timeout|timed out|socket|econn|enotfound|abort|refused|load failed|408|502|503|504|gateway/.test(
    normalized
  );
}

function isLikelyEvidenceUploadFailure(message: string) {
  const normalized = message.toLowerCase();
  return /suspicious clip segment|suspicious clip evidence upload|supabase storage rejected the upload|suspiciousvideos migration|storage policy|row-level security|permission denied|sign-in session/i.test(
    normalized
  );
}

export default function ExamSessionScreen() {
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === 'string' ? params.examId : '';

  const { colors } = useAppTheme();

  const [sessionData, setSessionData] = useState<StudentExamSessionData | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [proctoringStatus, setProctoringStatus] = useState<'idle' | 'starting' | 'active' | 'paused' | 'error'>(
    'idle'
  );
  const [proctoringMessage, setProctoringMessage] = useState('Preparing live analysis...');
  const [latestWindowLabel, setLatestWindowLabel] = useState<
    'NO_FACE' | 'NORMAL' | 'CAUTION' | 'SUSPICIOUS' | null
  >(null);
  const [latestWindowEventCount, setLatestWindowEventCount] = useState(0);
  const [latestWindowObservation, setLatestWindowObservation] = useState('');
  const [proctoringHandleRevision, setProctoringHandleRevision] = useState(0);

  const cameraRef = useRef<CameraView | null>(null);
  const monitorLoopActiveRef = useRef(false);
  const shouldMonitorRef = useRef(false);
  const isRecordingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const selectedOptionsRef = useRef<Record<string, string>>({});
  const sessionDataRef = useRef<StudentExamSessionData | null>(null);
  const timeoutSubmitTriggeredRef = useRef(false);
  const appExitStartedAtRef = useRef<number | null>(null);
  const appExitStartedIsoRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appExitHandlingRef = useRef(false);
  const proctoringHandleRef = useRef<ProctoringSessionHandle | null>(null);
  const heartbeatRefreshBusyRef = useRef(false);
  const lastSuccessfulAnalysisAtRef = useRef<number | null>(null);
  const startupWatchActiveRef = useRef(false);
  const aggregateMetricsRef = useRef(createEmptyAggregateMetrics());
  const recentSegmentsRef = useRef<LocalClipSegment[]>([]);
  const pendingTrailingEvidenceRef = useRef<PendingTrailingEvidence[]>([]);
  const evidenceUploadBlockedRef = useRef(false);
  const liveSuspiciousAlarmRef = useRef<Audio.Sound | null>(null);
  const liveSuspiciousAlarmLoadingRef = useRef(false);
  const liveSuspiciousAlarmWantedRef = useRef(false);
  const delayedAlertSoundsRef = useRef<Set<Audio.Sound>>(new Set());
  const delayedAlertTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const lastDelayedAlertSoundAtRef = useRef(0);

  const configureExamAudio = useCallback(async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: false,
      staysActiveInBackground: true,
    });
  }, []);

  const cleanupDelayedAlertSound = useCallback(async (sound: Audio.Sound) => {
    if (!delayedAlertSoundsRef.current.delete(sound)) {
      return;
    }

    try {
      await sound.stopAsync();
    } catch {
      // Best effort: audio cleanup must not interrupt the exam.
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Best effort: audio cleanup must not interrupt the exam.
    }
  }, []);

  const stopLiveSuspiciousAlarm = useCallback(() => {
    liveSuspiciousAlarmWantedRef.current = false;
    const sound = liveSuspiciousAlarmRef.current;
    liveSuspiciousAlarmRef.current = null;

    if (!sound) {
      return;
    }

    void (async () => {
      try {
        await sound.stopAsync();
      } catch {
        // Best effort: audio cleanup must not interrupt the exam.
      }

      try {
        await sound.unloadAsync();
      } catch {
        // Best effort: audio cleanup must not interrupt the exam.
      }
    })();
  }, []);

  const startLiveSuspiciousAlarm = useCallback(() => {
    liveSuspiciousAlarmWantedRef.current = true;

    if (liveSuspiciousAlarmRef.current || liveSuspiciousAlarmLoadingRef.current) {
      return;
    }

    liveSuspiciousAlarmLoadingRef.current = true;

    void (async () => {
      const sound = new Audio.Sound();

      try {
        await configureExamAudio();
        await sound.loadAsync(BEEP_SOUND_ASSET, {
          isLooping: true,
          shouldPlay: true,
          volume: 1,
        });

        if (!liveSuspiciousAlarmWantedRef.current) {
          await sound.unloadAsync();
          return;
        }

        liveSuspiciousAlarmRef.current = sound;
      } catch {
        liveSuspiciousAlarmWantedRef.current = false;
        try {
          await sound.unloadAsync();
        } catch {
          // Best effort: audio cleanup must not interrupt the exam.
        }
      } finally {
        liveSuspiciousAlarmLoadingRef.current = false;
      }
    })();
  }, [configureExamAudio]);

  const playDelayedSuspiciousAlertSound = useCallback(() => {
    const now = Date.now();
    if (now - lastDelayedAlertSoundAtRef.current < DELAYED_DETECTOR_ALERT_COOLDOWN_MS) {
      return;
    }

    lastDelayedAlertSoundAtRef.current = now;

    void (async () => {
      try {
        await configureExamAudio();
        const { sound } = await Audio.Sound.createAsync(BEEP_SOUND_ASSET, {
          isLooping: false,
          shouldPlay: true,
          volume: 0.85,
        });

        delayedAlertSoundsRef.current.add(sound);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            void cleanupDelayedAlertSound(sound);
          }
        });

        const timer = setTimeout(() => {
          delayedAlertTimersRef.current.delete(timer);
          void cleanupDelayedAlertSound(sound);
        }, DELAYED_DETECTOR_ALERT_SOUND_MS);
        delayedAlertTimersRef.current.add(timer);
      } catch {
        // Best effort: failed alert audio should never block monitoring.
      }
    })();
  }, [cleanupDelayedAlertSound, configureExamAudio]);

  const stopAllSuspiciousSounds = useCallback(() => {
    stopLiveSuspiciousAlarm();

    for (const timer of delayedAlertTimersRef.current) {
      clearTimeout(timer);
    }
    delayedAlertTimersRef.current.clear();

    const delayedSounds = [...delayedAlertSoundsRef.current];
    delayedAlertSoundsRef.current.clear();

    for (const sound of delayedSounds) {
      void (async () => {
        try {
          await sound.stopAsync();
        } catch {
          // Best effort: audio cleanup must not interrupt the exam.
        }

        try {
          await sound.unloadAsync();
        } catch {
          // Best effort: audio cleanup must not interrupt the exam.
        }
      })();
    }
  }, [stopLiveSuspiciousAlarm]);

  useEffect(() => {
    selectedOptionsRef.current = selectedOptions;
  }, [selectedOptions]);

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  const uploadSegmentIfNeeded = useCallback(async (segment: LocalClipSegment) => {
    if (segment.path) {
      return {
        path: segment.path,
        publicUrl: segment.publicUrl ?? null,
      };
    }

    if (evidenceUploadBlockedRef.current) {
      throw new Error(EVIDENCE_UPLOAD_BLOCKED_MESSAGE);
    }

    const handle = proctoringHandleRef.current;
    if (!handle) {
      throw new Error('No proctoring handle was found for clip upload.');
    }

    const clipExtension = deriveClipExtensionFromUri(segment.uri);
    const path = `${handle.examId}/${handle.studentId}/${handle.analysisSessionId}/segment-${Date.now()}-${randomId()}${clipExtension}`;
    let uploadedSegment: { path: string; publicUrl: string | null };
    try {
      uploadedSegment = await uploadSuspiciousClipSegment({
        clipUri: segment.uri,
        path,
      });
    } catch (error) {
      const uploadMessage = toErrorMessage(error, 'Unable to upload suspicious clip segment.');
      if (isLikelyEvidenceUploadFailure(uploadMessage)) {
        evidenceUploadBlockedRef.current = true;
      }
      throw error;
    }

    segment.path = uploadedSegment.path;
    segment.publicUrl = uploadedSegment.publicUrl;

    if (isManagedProctoringClipUri(segment.uri)) {
      await deleteClipFileIfPresent(segment.uri);
    }

    return uploadedSegment;
  }, []);

  const registerRecentSegment = useCallback((segment: LocalClipSegment) => {
    const segmentEndMs = toTimestampMs(segment.endedAtIso) ?? Date.now();
    const pruneBeforeMs = segmentEndMs - SEGMENT_PRUNE_WINDOW_SECONDS * 1000;
    const previousSegments = recentSegmentsRef.current;

    const nextSegments = [...previousSegments, segment]
      .filter((candidate) => {
        const candidateEndMs = toTimestampMs(candidate.endedAtIso);
        return candidateEndMs !== null && candidateEndMs >= pruneBeforeMs;
      })
      .sort((left, right) => {
        const leftStart = toTimestampMs(left.startedAtIso) ?? 0;
        const rightStart = toTimestampMs(right.startedAtIso) ?? 0;
        return leftStart - rightStart;
      });

    recentSegmentsRef.current = nextSegments;

    const retainedUris = new Set(nextSegments.map((candidate) => normalizeClipUri(candidate.uri)));
    const droppedManagedUris = previousSegments
      .map((candidate) => normalizeClipUri(candidate.uri))
      .filter((candidateUri) => candidateUri && !retainedUris.has(candidateUri))
      .filter((candidateUri) => isManagedProctoringClipUri(candidateUri));

    if (droppedManagedUris.length > 0) {
      void Promise.all(droppedManagedUris.map((clipUri) => deleteClipFileIfPresent(clipUri)));
    }
  }, []);

  const resolvePendingTrailingEvidence = useCallback(
    async (segment: LocalClipSegment) => {
      const pendingItems = pendingTrailingEvidenceRef.current;
      if (pendingItems.length === 0) {
        return false;
      }

      const segmentStartMs = toTimestampMs(segment.startedAtIso);
      const segmentEndMs = toTimestampMs(segment.endedAtIso);
      if (segmentStartMs === null || segmentEndMs === null) {
        return false;
      }

      let evidenceUploadFailed = false;
      let uploadedSegment: { path: string; publicUrl: string | null } | null = null;
      let attemptedSegmentUpload = false;
      let segmentUploadFailed = false;
      const nextPendingItems: PendingTrailingEvidence[] = [];

      for (const pending of pendingItems) {
        const eventWindowStartMs = toTimestampMs(pending.evidence.windowStartIso) ?? Number.NEGATIVE_INFINITY;
        const shouldAttachSegment =
          segmentEndMs > eventWindowStartMs && segmentStartMs < pending.targetWindowEndMs;

        if (shouldAttachSegment) {
          if (!attemptedSegmentUpload) {
            attemptedSegmentUpload = true;
            try {
              uploadedSegment = await uploadSegmentIfNeeded(segment);
            } catch (error) {
              const uploadMessage = toErrorMessage(
                error,
                'Unable to upload suspicious clip segment.'
              );
              if (!isLikelyEvidenceUploadFailure(uploadMessage)) {
                throw error;
              }
              segmentUploadFailed = true;
              evidenceUploadFailed = true;
            }
          }

          if (uploadedSegment) {
            appendEvidenceSegmentIfMissing(pending.evidence, {
              durationSeconds: segment.durationSeconds,
              endedAtIso: segment.endedAtIso,
              path: uploadedSegment.path,
              publicUrl: uploadedSegment.publicUrl,
              startedAtIso: segment.startedAtIso,
            });
          }

          pending.evidence.windowEndIso = new Date(
            Math.min(segmentEndMs, pending.targetWindowEndMs)
          ).toISOString();
          pending.evidence.wasTruncated = true;
        }

        if (segmentEndMs >= pending.targetWindowEndMs) {
          pending.evidence.windowEndIso = new Date(pending.targetWindowEndMs).toISOString();
          pending.evidence.wasTruncated =
            pending.missingLeadCoverage || segmentUploadFailed || pending.evidence.wasTruncated;
          await updateSuspiciousEventEvidence(pending.eventId, pending.evidence);
          continue;
        }

        if (shouldAttachSegment) {
          await updateSuspiciousEventEvidence(pending.eventId, pending.evidence);
        }

        nextPendingItems.push(pending);
      }

      pendingTrailingEvidenceRef.current = nextPendingItems;
      return evidenceUploadFailed;
    },
    [uploadSegmentIfNeeded]
  );

  const persistSuspiciousEvents = useCallback(
    async ({
      clip,
      events,
      detectorSessionId,
    }: {
      clip: LocalClipSegment;
      detectorSessionId: string | null;
      events: Awaited<ReturnType<typeof analyzeVideoSummary>>['events'];
    }) => {
      const handle = proctoringHandleRef.current;
      if (!handle || events.length === 0) {
        return false;
      }

      const clipStartTimeMs = new Date(clip.startedAtIso).getTime();
      const clipEndTimeMs = new Date(clip.endedAtIso).getTime();
      if (Number.isNaN(clipStartTimeMs) || Number.isNaN(clipEndTimeMs)) {
        return false;
      }

      let evidenceUploadFailed = false;

      for (const event of events) {
        const label = detectorLabelToAnalysisLabel(event.label);
        const eventScore = event.max_score;
        const eventStartMs = clipStartTimeMs + Number(event.start_timestamp_seconds) * 1000;
        const eventEndMs = clipStartTimeMs + Number(event.end_timestamp_seconds) * 1000;
        const desiredWindowStartMs = eventStartMs - EVIDENCE_LEAD_SECONDS * 1000;
        const desiredWindowEndMs = eventEndMs + EVIDENCE_TRAIL_SECONDS * 1000;
        const needsNextSegment = desiredWindowEndMs > clipEndTimeMs;
        const currentlyCoveredWindowEndMs = Math.min(desiredWindowEndMs, clipEndTimeMs);
        const candidateSegments = recentSegmentsRef.current.filter((candidate) =>
          isSegmentOverlappingWindow(candidate, desiredWindowStartMs, currentlyCoveredWindowEndMs)
        );
        const earliestCoveredMs = Math.min(
          ...candidateSegments.map((candidate) => toTimestampMs(candidate.startedAtIso) ?? Number.POSITIVE_INFINITY)
        );
        const missingLeadCoverage = !Number.isFinite(earliestCoveredMs) || earliestCoveredMs > desiredWindowStartMs;

        const evidence = buildSuspiciousEvidenceTemplate({
          detectorSessionId,
          durationSeconds: clip.durationSeconds,
          eventEndOffsetSeconds: Number(event.end_timestamp_seconds),
          eventDurationSeconds:
            typeof event.duration_seconds === 'number' && Number.isFinite(event.duration_seconds)
              ? Math.max(0, event.duration_seconds)
              : Math.max(
                  0,
                  Number(event.end_timestamp_seconds) - Number(event.start_timestamp_seconds)
                ),
          eventStartOffsetSeconds: Number(event.start_timestamp_seconds),
          severity: typeof event.severity === 'string' ? event.severity : null,
          signalCode: typeof event.signal_code === 'string' ? event.signal_code : null,
          requestedLeadSeconds: EVIDENCE_LEAD_SECONDS,
          requestedTrailSeconds: EVIDENCE_TRAIL_SECONDS,
          wasTruncated: missingLeadCoverage || needsNextSegment,
          windowEndIso: new Date(currentlyCoveredWindowEndMs).toISOString(),
          windowStartIso: new Date(desiredWindowStartMs).toISOString(),
        });

        for (const candidateSegment of candidateSegments) {
          try {
            const uploaded = await uploadSegmentIfNeeded(candidateSegment);
            appendEvidenceSegmentIfMissing(evidence, {
              durationSeconds: candidateSegment.durationSeconds,
              endedAtIso: candidateSegment.endedAtIso,
              path: uploaded.path,
              publicUrl: uploaded.publicUrl,
              startedAtIso: candidateSegment.startedAtIso,
            });
          } catch (error) {
            const uploadMessage = toErrorMessage(error, 'Unable to upload suspicious clip segment.');
            if (!isLikelyEvidenceUploadFailure(uploadMessage)) {
              throw error;
            }
            evidenceUploadFailed = true;
            evidence.wasTruncated = true;
          }
        }

        const suspiciousEventId = await insertSuspiciousEvent({
          analysisSessionId: handle.analysisSessionId,
          endFrameIndex: Math.max(0, Math.trunc(Number(event.end_frame_index))),
          endTimestampSeconds: Number(event.end_timestamp_seconds),
          evidence,
          examId: handle.examId,
          frameCount: Math.max(1, Math.trunc(Number(event.frame_count))),
          label,
          maxScore: eventScore,
          reason: String(event.reason ?? 'Suspicious behavior detected.'),
          riskLevel: detectorScoreToRiskLevel(eventScore),
          startFrameIndex: Math.max(0, Math.trunc(Number(event.start_frame_index))),
          startTimestampSeconds: Number(event.start_timestamp_seconds),
          studentId: handle.studentId,
        });

        if (needsNextSegment && !evidenceUploadFailed) {
          pendingTrailingEvidenceRef.current.push({
            eventId: suspiciousEventId,
            evidence,
            missingLeadCoverage,
            targetWindowEndMs: desiredWindowEndMs,
          });
        }
      }

      return evidenceUploadFailed;
    },
    [uploadSegmentIfNeeded]
  );

  const processRecordedClip = useCallback(
    async (segment: LocalClipSegment) => {
      const handle = proctoringHandleRef.current;
      const activeSession = sessionData;
      if (!handle || !activeSession) {
        return;
      }

      const detectorSampling = deriveDetectorSampling(activeSession.monitoringMode);
      const requestPayload = {
        aiSessionId: handle.aiSessionId,
        clipUri: segment.uri,
        maxFrames: detectorSampling.maxFrames,
        maxKeyFrames: 5,
        sampleEveryNFrames: detectorSampling.sampleEveryNFrames,
      };

      const analyzeWithClipFinalizeRetry = async (overrideSessionId?: string | null) => {
        const payload =
          overrideSessionId === undefined
            ? requestPayload
            : {
                ...requestPayload,
                aiSessionId: overrideSessionId,
              };
        try {
          return buildActionableDetectorSummary(await analyzeVideoSummary(payload));
        } catch (error) {
          const message = toErrorMessage(error, 'Live analysis request failed.').toLowerCase();
          const shouldRetryAfterFinalize =
            /uploaded file is not a valid video|moov atom|could not read any frames from the uploaded video/.test(
              message
            );
          if (!shouldRetryAfterFinalize) {
            throw error;
          }

          await waitForClipFinalizationRetryWindow(payload.clipUri);
          await sleep(260);
          return buildActionableDetectorSummary(await analyzeVideoSummary(payload));
        }
      };

      let summary: Awaited<ReturnType<typeof analyzeVideoSummary>>;
      try {
        summary = await analyzeWithClipFinalizeRetry();
      } catch (error) {
        const message = toErrorMessage(error, 'Live analysis request failed.');
        const shouldReconnect = isLikelyTransientNetworkFailure(message);

        if (!shouldReconnect) {
          throw error;
        }

        setProctoringStatus('active');
        setProctoringMessage('Reconnecting to detector service...');

        try {
          const refreshedDetectorSessionId = await createDetectorSession();
          handle.aiSessionId = refreshedDetectorSessionId;
        } catch {
          // Retry below even if detector session refresh fails.
        }

        try {
          summary = await analyzeWithClipFinalizeRetry(handle.aiSessionId);
        } catch (retryError) {
          const retryMessage = toErrorMessage(retryError, message);
          if (isLikelyTransientNetworkFailure(retryMessage)) {
            throw new Error(
              'Detector is unreachable right now. Keep the exam open, confirm EXPO_PUBLIC_CHEATING_DETECTOR_URL points to https://cheatingmonitormodel.onrender.com, and retry.'
            );
          }
          throw retryError;
        }
      }

      const detectorSessionId = String(summary.session_id ?? '').trim() || handle.aiSessionId;
      if (detectorSessionId && detectorSessionId !== handle.aiSessionId) {
        handle.aiSessionId = detectorSessionId;
      }

      lastSuccessfulAnalysisAtRef.current = Date.now();

      const mergedMetrics = mergeAggregateMetrics(aggregateMetricsRef.current, summary);
      aggregateMetricsRef.current = mergedMetrics;
      const latestWindowLabel = detectorLabelToAnalysisLabel(summary.final_label);
      const latestWindowFlaggedCount = Math.max(0, Math.trunc(Number(summary.suspicious_event_count ?? 0)));
      const latestWindowObservationSummary = buildDetectorObservationSummary(summary, 3, {
        includeAlertReasons: true,
        includeKeyFrameObservations: true,
      });
      const hasDelayedDetectorSuspicion =
        latestWindowFlaggedCount > 0 ||
        latestWindowLabel === 'NO_FACE' ||
        latestWindowLabel === 'CAUTION' ||
        latestWindowLabel === 'SUSPICIOUS';
      setLatestWindowLabel(latestWindowLabel);
      setLatestWindowEventCount(latestWindowFlaggedCount);
      setLatestWindowObservation(latestWindowObservationSummary);

      if (hasDelayedDetectorSuspicion) {
        playDelayedSuspiciousAlertSound();
      }

      registerRecentSegment(segment);
      let syncWarning = false;
      let evidenceUploadWarning = false;

      try {
        await syncAnalysisSessionMetrics({
          analysisSessionId: handle.analysisSessionId,
          backendSessionId: detectorSessionId,
          metrics: mergedMetrics,
          status: 'active',
        });
      } catch (syncError) {
        const syncMessage = toErrorMessage(syncError, 'Unable to sync live analysis metrics.');
        if (!isLikelyTransientNetworkFailure(syncMessage)) {
          throw syncError;
        }
        syncWarning = true;
      }

      try {
        evidenceUploadWarning = await resolvePendingTrailingEvidence(segment);
        const suspiciousEventUploadWarning = await persistSuspiciousEvents({
          clip: segment,
          detectorSessionId,
          events: summary.events ?? [],
        });
        evidenceUploadWarning = evidenceUploadWarning || suspiciousEventUploadWarning;
      } catch (eventSyncError) {
        const eventSyncMessage = toErrorMessage(
          eventSyncError,
          'Unable to sync suspicious event evidence.'
        );
        if (!isLikelyTransientNetworkFailure(eventSyncMessage)) {
          throw eventSyncError;
        }
        syncWarning = true;
      }

      setProctoringStatus('active');

      if (syncWarning) {
        setProctoringMessage(
          'Live analysis is running, but sync to the server is delayed. Retrying automatically...'
        );
        return;
      }

      if (evidenceUploadWarning) {
        setProctoringMessage(EVIDENCE_UPLOAD_WARNING_MESSAGE);
        return;
      }

      setProctoringMessage(
        latestWindowFlaggedCount > 0
          ? `${latestWindowFlaggedCount} suspicious event(s) detected in the latest window.${latestWindowObservationSummary ? ` Reasons: ${latestWindowObservationSummary}` : ''}`
          : 'Live analysis running. No suspicious activity in the latest window.'
      );
    },
    [
      persistSuspiciousEvents,
      playDelayedSuspiciousAlertSound,
      registerRecentSegment,
      resolvePendingTrailingEvidence,
      sessionData,
    ]
  );

  const recordOneClip = useCallback(async (): Promise<LocalClipSegment | null> => {
    const camera = cameraRef.current as
      | (CameraView & { recordAsync?: (options?: unknown) => Promise<{ uri: string }> })
      | null;
    if (!camera) {
      return null;
    }

    if (typeof camera.recordAsync !== 'function') {
      throw new Error(
        'Live analysis recording is not available on this device/build. Use a native dev build and retry.'
      );
    }

    const startedAtIso = new Date().toISOString();
    isRecordingRef.current = true;

    try {
      let recording: { uri: string } | null = null;

      try {
        recording =
          (await camera.recordAsync({
            maxDuration: CLIP_SECONDS,
            quality: '480p',
          })) ?? null;
      } catch {
        // Some devices reject explicit quality presets. Retry with minimal options.
        recording =
          (await camera.recordAsync({
            maxDuration: CLIP_SECONDS,
          })) ?? null;
      }

      if (!recording?.uri) {
        return null;
      }

      const endedAtIso = new Date().toISOString();
      // Give the native recorder a moment to finalize container metadata (moov atom).
      await sleep(240);
      await waitForRecordedClipReady(recording.uri, {
        minBytes: CLIP_READY_MIN_BYTES,
        pollMs: 150,
        stableReads: 3,
        timeoutMs: 6500,
      });
      let clipUri = normalizeClipUri(recording.uri);
      if (clipUri) {
        try {
          clipUri = await copyClipIntoManagedCache(clipUri);
        } catch {
          // Continue with the original URI if managed cache copy fails.
          clipUri = normalizeClipUri(recording.uri);
        }
      }

      const durationSeconds = Math.max(
        0.1,
        (new Date(endedAtIso).getTime() - new Date(startedAtIso).getTime()) / 1000
      );

      return {
        durationSeconds,
        endedAtIso,
        startedAtIso,
        uri: clipUri || recording.uri,
      };
    } finally {
      isRecordingRef.current = false;
    }
  }, []);

  const runMonitoringLoop = useCallback(async () => {
    if (monitorLoopActiveRef.current) {
      return;
    }

    monitorLoopActiveRef.current = true;
    try {
      while (shouldMonitorRef.current) {
        const handle = proctoringHandleRef.current;
        if (!handle) {
          await sleep(300);
          continue;
        }

        let clip: LocalClipSegment | null = null;
        try {
          clip = await recordOneClip();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Camera capture failed. Check camera access and retry.';
          if (isLikelyUnfinalizedClipError(message)) {
            setProctoringStatus('active');
            setProctoringMessage('Finalizing recorded clip... retrying this window automatically.');
            await clearManagedProctoringClipCache({
              keepUris: recentSegmentsRef.current.map((segment) => segment.uri),
            });
            await sleep(320);
            continue;
          }
          setProctoringStatus('error');
          setProctoringMessage(message);
          await clearManagedProctoringClipCache({
            keepUris: recentSegmentsRef.current.map((segment) => segment.uri),
          });
          await sleep(700);
          continue;
        }

        if (!clip) {
          await clearManagedProctoringClipCache({
            keepUris: recentSegmentsRef.current.map((segment) => segment.uri),
          });
          await sleep(160);
          continue;
        }

        try {
          await processRecordedClip(clip);
        } catch (error) {
          const message = toErrorMessage(
            error,
            'Live detector failed for the latest clip window.'
          );
          if (isLikelyTransientNetworkFailure(message)) {
            setProctoringStatus('active');
            setProctoringMessage('Detector connection dropped for this window. Retrying automatically...');
            await sleep(700);
            continue;
          }

          if (isLikelyEvidenceUploadFailure(message)) {
            evidenceUploadBlockedRef.current = true;
            setProctoringStatus('active');
            setProctoringMessage(EVIDENCE_UPLOAD_WARNING_MESSAGE);
            await sleep(700);
            continue;
          }

          setProctoringStatus('error');
          setProctoringMessage(message);
        } finally {
          await clearManagedProctoringClipCache({
            keepUris: recentSegmentsRef.current.map((segment) => segment.uri),
          });
        }
      }
    } finally {
      monitorLoopActiveRef.current = false;
    }
  }, [processRecordedClip, recordOneClip]);

  const finalizeProctoring = useCallback(
    async (finalStatus: 'submitted' | 'paused' | 'terminated') => {
      stopAllSuspiciousSounds();
      shouldMonitorRef.current = false;

      if (isRecordingRef.current) {
        try {
          (cameraRef.current as (CameraView & { stopRecording?: () => void }) | null)?.stopRecording?.();
        } catch {
          // Ignore stop-recording errors during teardown.
        }
      }

      for (let attempts = 0; attempts < 80; attempts += 1) {
        if (!monitorLoopActiveRef.current && !isRecordingRef.current) {
          break;
        }
        await sleep(120);
      }

      const handle = proctoringHandleRef.current;
      if (handle) {
        try {
          await endProctoringSession({
            analysisSessionId: handle.analysisSessionId,
            finalMetrics: aggregateMetricsRef.current,
            finalStatus,
          });
        } catch {
          // Keep exam flow resilient; this can be retried by invigilator review if needed.
        }

        await deleteDetectorSession(handle.aiSessionId);
      }

      proctoringHandleRef.current = null;
      heartbeatRefreshBusyRef.current = false;
      pendingTrailingEvidenceRef.current = [];
      recentSegmentsRef.current = [];
      evidenceUploadBlockedRef.current = false;
      lastSuccessfulAnalysisAtRef.current = null;
      await clearManagedProctoringClipCache();

      if (finalStatus === 'submitted') {
        setProctoringStatus('paused');
        setProctoringMessage('Live analysis submitted with exam.');
      } else if (finalStatus === 'paused') {
        setProctoringStatus('paused');
        setProctoringMessage('Live analysis paused.');
      } else {
        setProctoringStatus('error');
        setProctoringMessage('Live analysis terminated.');
      }
    },
    [stopAllSuspiciousSounds]
  );

  useEffect(() => {
    let isMounted = true;

    const loadExamSession = async () => {
      setIsLoading(true);
      setErrorMessage('');
      hasSubmittedRef.current = false;
      timeoutSubmitTriggeredRef.current = false;
      heartbeatRefreshBusyRef.current = false;
      recentSegmentsRef.current = [];
      pendingTrailingEvidenceRef.current = [];
      evidenceUploadBlockedRef.current = false;
      lastSuccessfulAnalysisAtRef.current = null;
      startupWatchActiveRef.current = false;
      aggregateMetricsRef.current = createEmptyAggregateMetrics();
      setLatestWindowLabel(null);
      setLatestWindowEventCount(0);
      setLatestWindowObservation('');
      setCameraReady(false);
      await clearManagedProctoringClipCache();

      try {
        if (!examId) {
          throw new Error('No exam was selected.');
        }

        const result = await fetchStudentExamSessionData(examId);
        if (!isMounted) {
          return;
        }

        if (result.hasSubmitted) {
          void clearStoredAppExitMarker().catch(() => undefined);
          router.replace({
            pathname: '/(tabs)/results',
            params: { examId: result.examId },
          });
          return;
        }

        setSessionData(result);
        setSelectedOptions({});
        setQuestionIndex(0);
        setRemainingSeconds(deriveRemainingSeconds(result.scheduledEnd));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load this exam session.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadExamSession();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  useEffect(() => {
    if (!sessionData) {
      return;
    }

    if (cameraPermission?.granted || cameraPermission?.canAskAgain === false) {
      return;
    }

    void requestCameraPermission();
  }, [cameraPermission?.canAskAgain, cameraPermission?.granted, requestCameraPermission, sessionData]);

  useEffect(() => {
    if (!sessionData) {
      return;
    }

    if (proctoringHandleRef.current?.examId === sessionData.examId) {
      return;
    }

    let isCancelled = false;
    startupWatchActiveRef.current = true;
    setProctoringStatus('starting');
    setProctoringMessage('Preparing live analysis...');

    const bootstrap = async () => {
      try {
        const handle = await ensureActiveProctoringSession({
          examId: sessionData.examId,
          monitoringMode: sessionData.monitoringMode,
        });

        if (isCancelled) {
          await deleteDetectorSession(handle.aiSessionId);
          return;
        }

        proctoringHandleRef.current = handle;
        // Keep null until the first successful detector response arrives.
        lastSuccessfulAnalysisAtRef.current = null;
        setProctoringHandleRevision((current) => current + 1);
        setProctoringStatus('starting');
        setProctoringMessage('Camera is preparing for live analysis...');
      } catch (error) {
        if (!isCancelled) {
          startupWatchActiveRef.current = false;
          setProctoringStatus('error');
          setProctoringMessage(
            error instanceof Error
              ? error.message
              : 'Unable to initialize live exam analysis.'
          );
        }
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [sessionData]);

  useEffect(() => {
    if (!sessionData) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRemainingSeconds(deriveRemainingSeconds(sessionData.scheduledEnd));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [sessionData]);

  useEffect(() => {
    const canRun =
      Boolean(sessionData) &&
      Boolean(cameraPermission?.granted) &&
      cameraReady &&
      Boolean(proctoringHandleRef.current);
    const currentCamera =
      cameraRef.current as (CameraView & { stopRecording?: () => void }) | null;

    shouldMonitorRef.current = canRun;

    if (canRun) {
      startupWatchActiveRef.current = false;
      if (proctoringStatus === 'starting') {
        setProctoringStatus('active');
        setProctoringMessage('Live capture started. Waiting for detector response...');
      }
      void runMonitoringLoop();
    }

    return () => {
      shouldMonitorRef.current = false;
      if (isRecordingRef.current) {
        try {
          currentCamera?.stopRecording?.();
        } catch {
          // Ignore stop errors.
        }
      }
    };
  }, [cameraPermission?.granted, cameraReady, proctoringHandleRevision, proctoringStatus, runMonitoringLoop, sessionData]);

  useEffect(() => {
    if (proctoringStatus !== 'starting' || !startupWatchActiveRef.current) {
      return;
    }

    const startupTimeout = setTimeout(() => {
      if (!startupWatchActiveRef.current || proctoringStatus !== 'starting') {
        return;
      }
      setProctoringStatus('error');
      setProctoringMessage(
        'Live analysis startup timed out. Check camera permission and detector service, then reopen this exam.'
      );
    }, 45_000);

    return () => {
      clearTimeout(startupTimeout);
    };
  }, [proctoringStatus]);

  useEffect(() => {
    if (!sessionData || !cameraPermission?.granted || !cameraReady || proctoringStatus === 'error') {
      return;
    }

    const heartbeatTimer = setInterval(() => {
      if (heartbeatRefreshBusyRef.current) {
        return;
      }

      const handle = proctoringHandleRef.current;
      if (!handle) {
        return;
      }

      const lastSuccessfulAt = lastSuccessfulAnalysisAtRef.current;
      if (lastSuccessfulAt === null) {
        return;
      }

      const staleForMs = Date.now() - lastSuccessfulAt;
      if (staleForMs < 18_000) {
        return;
      }

      heartbeatRefreshBusyRef.current = true;
      setProctoringStatus('active');
      setProctoringMessage('Refreshing live detector connection...');

      void (async () => {
        try {
          const refreshedDetectorSessionId = await createDetectorSession();
          if (proctoringHandleRef.current?.analysisSessionId === handle.analysisSessionId) {
            proctoringHandleRef.current.aiSessionId = refreshedDetectorSessionId;
            lastSuccessfulAnalysisAtRef.current = Date.now();
          }
        } catch {
          // Keep loop running; request retries happen in clip processing too.
        } finally {
          heartbeatRefreshBusyRef.current = false;
        }
      })();
    }, 6_000);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [cameraPermission?.granted, cameraReady, proctoringStatus, sessionData]);

  useEffect(() => {
    return () => {
      void finalizeProctoring(hasSubmittedRef.current ? 'submitted' : 'paused');
    };
  }, [finalizeProctoring]);

  const questions = sessionData?.questions ?? EMPTY_QUESTIONS;
  const totalQuestions = questions.length;
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const selectedOptionId = selectedOptions[question.id];
        return Boolean(selectedOptionId);
      }).length,
    [questions, selectedOptions]
  );
  const currentQuestion = questions[questionIndex] ?? null;
  const progressPercent =
    totalQuestions > 0 ? Math.round(((questionIndex + 1) / totalQuestions) * 100) : 0;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectOption = (questionId: string, optionId: string) => {
    setSelectedOptions((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const recordAppExitViolation = useCallback(
    async ({
      durationMs,
      forcedSubmit,
      returnedAtIso,
      startedAtIso,
    }: {
      durationMs: number;
      forcedSubmit: boolean;
      returnedAtIso: string;
      startedAtIso: string;
    }) => {
      const handle = proctoringHandleRef.current;
      const durationSeconds = Math.max(0.01, durationMs / 1000);
      const maxScore = forcedSubmit ? 98 : 82;
      const reason = forcedSubmit
        ? `Student left the exam app for ${formatDurationSeconds(durationMs)}, exceeding the 10s auto-submit threshold. Exam was force-submitted.`
        : `Student left the exam app for ${formatDurationSeconds(durationMs)}, exceeding the 5s app-exit warning threshold.`;

      setProctoringMessage(reason);

      if (!handle) {
        return;
      }

      const evidence = buildSuspiciousEvidenceTemplate({
        detectorSessionId: handle.aiSessionId,
        durationSeconds,
        eventDurationSeconds: durationSeconds,
        eventEndOffsetSeconds: durationSeconds,
        eventStartOffsetSeconds: 0,
        requestedLeadSeconds: 0,
        requestedTrailSeconds: 0,
        severity: forcedSubmit ? 'critical' : 'high',
        signalCode: forcedSubmit ? 'APP_EXIT_FORCE_SUBMIT' : 'APP_EXIT_OVER_5S',
        wasTruncated: true,
        windowEndIso: returnedAtIso,
        windowStartIso: startedAtIso,
      });

      await insertSuspiciousEvent({
        analysisSessionId: handle.analysisSessionId,
        endFrameIndex: 0,
        endTimestampSeconds: durationSeconds,
        evidence,
        examId: handle.examId,
        frameCount: 1,
        label: 'SUSPICIOUS',
        maxScore,
        reason,
        riskLevel: forcedSubmit ? 'critical' : 'high',
        source: 'app-state',
        startFrameIndex: 0,
        startTimestampSeconds: 0,
        studentId: handle.studentId,
      });

      const nextMetrics = {
        ...aggregateMetricsRef.current,
        finalLabel: 'SUSPICIOUS' as const,
        latestObservation: reason,
        maxScore: Math.max(aggregateMetricsRef.current.maxScore, maxScore),
        suspiciousEventCount: aggregateMetricsRef.current.suspiciousEventCount + 1,
      };
      aggregateMetricsRef.current = nextMetrics;

      await syncAnalysisSessionMetrics({
        analysisSessionId: handle.analysisSessionId,
        backendSessionId: handle.aiSessionId,
        metrics: nextMetrics,
        status: 'active',
      });
    },
    []
  );

  const submitCurrentAnswers = useCallback(
    async (options: { forcedMessage?: string; throwOnError?: boolean } = {}) => {
      const activeSession = sessionDataRef.current;

      if (!activeSession || hasSubmittedRef.current) {
        return;
      }

      setIsSubmitting(true);
      setErrorMessage('');

      if (options.forcedMessage) {
        setShowConfirm(false);
        setProctoringMessage(options.forcedMessage);
      }

      try {
        await submitStudentExamAnswers({
          answers: activeSession.questions.map((question) => ({
            questionId: question.id,
            selectedOptionId: selectedOptionsRef.current[question.id] ?? null,
          })),
          examIdInput: activeSession.examId,
        });

        hasSubmittedRef.current = true;
        void clearStoredAppExitMarker().catch(() => undefined);
        await finalizeProctoring('submitted');
        setShowConfirm(false);
        router.replace({
          pathname: '/(tabs)/results',
          params: { examId: activeSession.examId },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to submit exam answers.';
        setErrorMessage(message);
        setShowConfirm(false);

        if (options.throwOnError) {
          throw error instanceof Error ? error : new Error(message);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [finalizeProctoring]
  );

  const handleSubmit = useCallback(async () => {
    if (!sessionDataRef.current) {
      return;
    }

    await submitCurrentAnswers();
  }, [submitCurrentAnswers]);

  useEffect(() => {
    if (!sessionData || isLoading || Boolean(errorMessage)) {
      return;
    }

    if (remainingSeconds > 0 || isSubmitting || hasSubmittedRef.current) {
      return;
    }

    if (timeoutSubmitTriggeredRef.current) {
      return;
    }

    timeoutSubmitTriggeredRef.current = true;
    setShowConfirm(false);
    setProctoringMessage('Exam time is over. Submitting your answers...');
    void submitCurrentAnswers({
      forcedMessage: 'Exam time is over. Submitting your answers...',
    });
  }, [errorMessage, isLoading, isSubmitting, remainingSeconds, sessionData, submitCurrentAnswers]);

  const processAppExitReturn = useCallback(
    ({
      durationMs,
      returnedAtIso,
      startedAtIso,
    }: {
      durationMs: number;
      returnedAtIso: string;
      startedAtIso: string;
    }) => {
      if (
        durationMs < APP_EXIT_FLAG_THRESHOLD_MS ||
        appExitHandlingRef.current ||
        hasSubmittedRef.current
      ) {
        return;
      }

      appExitHandlingRef.current = true;
      const shouldForceSubmit = durationMs >= APP_EXIT_FORCE_SUBMIT_THRESHOLD_MS;

      void (async () => {
        let violationError: unknown = null;

        try {
          await recordAppExitViolation({
            durationMs,
            forcedSubmit: shouldForceSubmit,
            returnedAtIso,
            startedAtIso,
          });
        } catch (error) {
          violationError = error;
        }

        try {
          if (shouldForceSubmit && !hasSubmittedRef.current) {
            await submitCurrentAnswers({
              forcedMessage: `Exam app was left for ${formatDurationSeconds(durationMs)}. Submitting your exam automatically.`,
              throwOnError: true,
            });
          }
        } catch (submitError) {
          setProctoringStatus('error');
          setProctoringMessage(
            submitError instanceof Error
              ? `Unable to auto-submit after app exit: ${submitError.message}`
              : 'Unable to auto-submit after app exit.'
          );
          return;
        } finally {
          appExitHandlingRef.current = false;
        }

        if (violationError && !hasSubmittedRef.current) {
          setProctoringStatus('error');
          setProctoringMessage(
            violationError instanceof Error
              ? `Unable to record app-exit violation: ${violationError.message}`
              : 'Unable to record app-exit violation.'
          );
        }
      })();
    },
    [recordAppExitViolation, submitCurrentAnswers]
  );

  useEffect(() => {
    if (!sessionData || hasSubmittedRef.current) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      subscription.remove();
    };
  }, [sessionData]);

  useEffect(() => {
    if (!sessionData || isLoading || Boolean(errorMessage)) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (hasSubmittedRef.current) {
        appExitStartedAtRef.current = null;
        appExitStartedIsoRef.current = null;
        stopLiveSuspiciousAlarm();
        return;
      }

      if (previousState === 'active' && nextState !== 'active') {
        const startedAtMs = Date.now();
        const startedAtIso = new Date(startedAtMs).toISOString();
        appExitStartedAtRef.current = startedAtMs;
        appExitStartedIsoRef.current = startedAtIso;
        startLiveSuspiciousAlarm();
        void writeStoredAppExitMarker({
          examId: sessionData.examId,
          startedAtIso,
          startedAtMs,
        }).catch(() => undefined);
        return;
      }

      if (nextState === 'active') {
        stopLiveSuspiciousAlarm();
      }

      if (nextState !== 'active' || appExitStartedAtRef.current === null) {
        return;
      }

      const startedAtMs = appExitStartedAtRef.current;
      const startedAtIso = appExitStartedIsoRef.current ?? new Date(startedAtMs).toISOString();
      const returnedAtIso = new Date().toISOString();
      const durationMs = Math.max(0, Date.now() - startedAtMs);
      appExitStartedAtRef.current = null;
      appExitStartedIsoRef.current = null;

      void clearStoredAppExitMarker().catch(() => undefined);
      processAppExitReturn({
        durationMs,
        returnedAtIso,
        startedAtIso,
      });
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [
    errorMessage,
    isLoading,
    processAppExitReturn,
    sessionData,
    startLiveSuspiciousAlarm,
    stopLiveSuspiciousAlarm,
  ]);

  useEffect(() => {
    if (!sessionData || isLoading || Boolean(errorMessage) || hasSubmittedRef.current) {
      return;
    }

    const activeHandle = proctoringHandleRef.current;
    if (!activeHandle || activeHandle.examId !== sessionData.examId) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      const marker = await readStoredAppExitMarker();
      if (isCancelled || !marker) {
        return;
      }

      if (marker.examId !== sessionData.examId) {
        await clearStoredAppExitMarker().catch(() => undefined);
        return;
      }

      const durationMs = Math.max(0, Date.now() - marker.startedAtMs);
      const returnedAtIso = new Date().toISOString();
      await clearStoredAppExitMarker().catch(() => undefined);

      if (isCancelled) {
        return;
      }

      processAppExitReturn({
        durationMs,
        returnedAtIso,
        startedAtIso: marker.startedAtIso,
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    errorMessage,
    isLoading,
    processAppExitReturn,
    proctoringHandleRevision,
    sessionData,
  ]);

  const aggregateMetrics = aggregateMetricsRef.current;
  const hasSampledFrames = aggregateMetrics.framesSampled > 0;
  const totalFlaggedMoments = aggregateMetrics.suspiciousEventCount;
  const peakRiskPercent = hasSampledFrames ? clampPercent(aggregateMetrics.maxScore) : 0;
  const averageRiskPercent = hasSampledFrames ? clampPercent(aggregateMetrics.averageScore) : 0;
  const sampleCoveragePercent =
    aggregateMetrics.framesProcessed > 0
      ? clampPercent((aggregateMetrics.framesSampled / aggregateMetrics.framesProcessed) * 100)
      : 0;
  const detectionDensityPercent =
    aggregateMetrics.framesSampled > 0
      ? clampPercent((aggregateMetrics.detections / aggregateMetrics.framesSampled) * 100)
      : 0;
  const eventsPercent = clampPercent(Math.min(totalFlaggedMoments * 20, 100));
  const metrics = [
    {
      label: 'RISK',
      percent: peakRiskPercent,
      value: `${peakRiskPercent}%`,
    },
    {
      label: 'AVG',
      percent: averageRiskPercent,
      value: `${averageRiskPercent}%`,
    },
    {
      label: 'SAMP',
      percent: sampleCoveragePercent,
      value: `${sampleCoveragePercent}%`,
    },
    {
      label: 'DET',
      percent: detectionDensityPercent,
      value: String(aggregateMetrics.detections),
    },
    {
      label: 'EVT',
      percent: eventsPercent,
      value: String(totalFlaggedMoments),
    },
  ];
  const effectiveWindowLabel =
    latestWindowLabel ?? (hasSampledFrames ? aggregateMetrics.finalLabel : null);
  const faceDetected =
    hasSampledFrames && proctoringStatus !== 'error' && effectiveWindowLabel !== 'NO_FACE';
  const onScreen = hasSampledFrames && faceDetected && effectiveWindowLabel === 'NORMAL';
  const hasMonitoringAlert =
    proctoringStatus === 'error' ||
    (hasSampledFrames &&
      (latestWindowEventCount > 0 ||
        effectiveWindowLabel === 'NO_FACE' ||
        effectiveWindowLabel === 'CAUTION' ||
        effectiveWindowLabel === 'SUSPICIOUS'));
  const monitoringAlertMessage =
    proctoringStatus === 'error'
      ? proctoringMessage
      : !hasSampledFrames
      ? 'Live monitoring active. Waiting for first detection window...'
      : latestWindowEventCount > 0
      ? `${latestWindowEventCount} suspicious event(s) detected in the latest window.${latestWindowObservation ? ` Reasons: ${latestWindowObservation}` : ''}`
      : effectiveWindowLabel === 'NO_FACE'
      ? `Face is not visible in the latest 5-second window.${latestWindowObservation ? ` ${latestWindowObservation}` : ''}`
      : effectiveWindowLabel === 'CAUTION'
      ? `Monitoring caution in the latest 5-second window.${latestWindowObservation ? ` ${latestWindowObservation}` : ''}`
      : effectiveWindowLabel === 'SUSPICIOUS'
      ? `Suspicious activity detected in the latest 5-second window.${latestWindowObservation ? ` ${latestWindowObservation}` : ''}`
      : 'No suspicious activity in the latest 5-second window.';
  const faceBadgeMode = !hasSampledFrames ? 'pending' : faceDetected ? 'good' : 'warning';
  const screenBadgeMode = !hasSampledFrames ? 'pending' : onScreen ? 'good' : 'warning';
  const normalizedCourseCode = String(sessionData?.courseCode ?? '')
    .trim()
    .toUpperCase();
  const normalizedExamTitle = String(sessionData?.examTitle ?? sessionData?.courseTitle ?? '').trim();
  const examMeta =
    normalizedCourseCode && normalizedExamTitle
      ? `${normalizedCourseCode} . ${normalizedExamTitle.toUpperCase()}`
      : isLoading
      ? 'LOADING EXAM DETAILS...'
      : errorMessage
      ? 'EXAM DETAILS UNAVAILABLE'
      : 'LOADING EXAM...';
  const gazeTag = normalizedCourseCode.replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'ST';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text numberOfLines={1} style={styles.headerMeta}>
            {examMeta}
          </Text>
          <View style={styles.timerBox}>
            <Text style={styles.timerText}>{formatCountdown(remainingSeconds)}</Text>
          </View>
        </View>

        {!isLoading && !errorMessage ? (
          <View style={styles.monitorCard}>
            <View style={[styles.monitorAlert, hasMonitoringAlert ? styles.monitorAlertWarning : null]}>
              <Feather
                color={hasMonitoringAlert ? colors.warning : colors.success}
                name={hasMonitoringAlert ? 'alert-triangle' : 'check-circle'}
                size={14}
              />
              <Text style={[styles.monitorAlertText, hasMonitoringAlert ? styles.monitorAlertTextWarning : null]}>
                {monitoringAlertMessage}
              </Text>
            </View>

            <View style={styles.monitorStatsRow}>
              <View style={styles.gazeCard}>
                <View style={styles.gazeBackdrop}>
                  {cameraPermission?.granted ? (
                    <CameraView
                      active
                      facing="front"
                      mode="video"
                      mute
                      onCameraReady={() => setCameraReady(true)}
                      onMountError={() => {
                        setProctoringStatus('error');
                        setProctoringMessage('Camera failed to start. Check permissions and retry.');
                      }}
                      ref={cameraRef}
                      style={styles.cameraPreview}
                    />
                  ) : (
                    <View style={styles.cameraPlaceholder}>
                      <Feather color={colors.muted} name="camera-off" size={16} />
                    </View>
                  )}
                  <View pointerEvents="none" style={styles.gazeOuterTarget} />
                  <View pointerEvents="none" style={styles.gazeInnerTarget} />
                  <View pointerEvents="none" style={styles.gazeDot} />
                  <View pointerEvents="none" style={styles.gazeTag}>
                    <Text style={styles.gazeTagText}>{gazeTag}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricsPanel}>
                {metrics.map((metric) => (
                  <View key={metric.label} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <View style={styles.metricTrack}>
                      <View style={[styles.metricFill, { width: `${metric.percent}%` }]} />
                    </View>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.monitorBadgeRow}>
              <View
                style={[
                  styles.monitorBadge,
                  faceBadgeMode === 'good'
                    ? styles.monitorBadgeGood
                    : faceBadgeMode === 'pending'
                    ? styles.monitorBadgePending
                    : styles.monitorBadgeWarn,
                ]}>
                <Text
                  style={[
                    styles.monitorBadgeText,
                    faceBadgeMode === 'good'
                      ? styles.monitorBadgeTextGood
                      : faceBadgeMode === 'pending'
                      ? styles.monitorBadgeTextPending
                      : null,
                  ]}>
                  {faceBadgeMode === 'pending' ? 'FACE WAIT' : faceBadgeMode === 'good' ? 'FACE OK' : 'FACE ALERT'}
                </Text>
              </View>
              <View
                style={[
                  styles.monitorBadge,
                  screenBadgeMode === 'good'
                    ? styles.monitorBadgeGood
                    : screenBadgeMode === 'pending'
                    ? styles.monitorBadgePending
                    : styles.monitorBadgeWarn,
                ]}>
                <Text
                  style={[
                    styles.monitorBadgeText,
                    screenBadgeMode === 'good'
                      ? styles.monitorBadgeTextGood
                      : screenBadgeMode === 'pending'
                      ? styles.monitorBadgeTextPending
                      : null,
                  ]}>
                  {screenBadgeMode === 'pending'
                    ? 'SCREEN WAIT'
                    : screenBadgeMode === 'good'
                    ? 'ON SCREEN'
                    : 'OFF SCREEN'}
                </Text>
              </View>
              <Text style={styles.flagCount}>{totalFlaggedMoments} FLAGGED</Text>
            </View>

            <Text style={styles.monitorHint}>{proctoringMessage}</Text>

            {!cameraPermission?.granted ? (
              <Pressable onPress={() => void requestCameraPermission()} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Enable camera for exam monitoring</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.teal} size="small" />
            <Text style={styles.loadingText}>Loading exam questions...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            {!sessionData ? (
              <Pressable onPress={() => router.replace('/(tabs)')} style={styles.errorAction}>
                <Text style={styles.errorActionText}>Back to dashboard</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!isLoading && !errorMessage && currentQuestion ? (
          <View style={styles.questionSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                Q{questionIndex + 1} / {totalQuestions}
              </Text>
              <Text style={styles.progressLabel}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>

            <Text style={styles.question}>{currentQuestion.prompt}</Text>

            <View style={styles.optionsList}>
              {currentQuestion.options.map((option) => {
                const active = selectedOptions[currentQuestion.id] === option.id;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => selectOption(currentQuestion.id, option.id)}
                    style={[styles.optionCard, active ? styles.optionCardActive : null]}>
                    <View style={[styles.choiceBox, active ? styles.choiceBoxActive : null]} />
                    <Text style={styles.optionKey}>{option.label}.</Text>
                    <Text style={styles.optionText}>{option.text}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.answerCounter}>
              {answeredCount} / {totalQuestions} answered
            </Text>

            {questionIndex < totalQuestions - 1 ? (
              <View style={styles.navigationRow}>
                <Pressable
                  disabled={questionIndex === 0}
                  onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                  style={[
                    styles.navigationButton,
                    styles.navigationButtonSecondary,
                    questionIndex === 0 ? styles.navigationButtonDisabled : null,
                  ]}>
                  <Text style={styles.navigationButtonTextSecondary}>Previous</Text>
                </Pressable>
                <Pressable
                  onPress={() => setQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1))}
                  style={styles.navigationButton}>
                  <Text style={styles.navigationButtonText}>Next Question</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowConfirm(true)} style={styles.submitButton}>
                <Text style={styles.submitText}>Submit Exam</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {!isLoading && !errorMessage && !currentQuestion && totalQuestions > 0 ? (
          <View style={styles.emptyQuestionState}>
            <Text style={styles.emptyQuestionText}>
              Unable to load this question. Move back or reopen the exam session.
            </Text>
            <View style={styles.navigationRow}>
              <Pressable
                disabled={questionIndex === 0}
                onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                style={[
                  styles.navigationButton,
                  styles.navigationButtonSecondary,
                  questionIndex === 0 ? styles.navigationButtonDisabled : null,
                ]}>
                <Text style={styles.navigationButtonTextSecondary}>Previous</Text>
              </Pressable>
              <Pressable
                disabled={questionIndex >= totalQuestions - 1}
                onPress={() => setQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1))}
                style={[
                  styles.navigationButton,
                  questionIndex >= totalQuestions - 1 ? styles.navigationButtonDisabled : null,
                ]}>
                <Text style={styles.navigationButtonText}>Next Question</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
        transparent
        visible={showConfirm}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>CONFIRM SUBMISSION</Text>
            <Text style={styles.modalTitle}>Submit exam?</Text>
            <Text style={styles.modalCopy}>
              You have answered <Text style={styles.modalCopyStrong}>{answeredCount}</Text> of{' '}
              <Text style={styles.modalCopyStrong}>{totalQuestions}</Text> questions.
            </Text>

            <Pressable
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={[styles.modalPrimaryButton, isSubmitting ? styles.primaryButtonDisabled : null]}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.modalPrimaryText}>Yes, submit</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={() => setShowConfirm(false)}
              style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
  answerCounter: {
    color: colors.mutedStrong,
    fontSize: type.body,
    marginTop: 16,
  },
  cameraPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cameraPreview: {
    height: '100%',
    opacity: 0.85,
    width: '100%',
  },
  choiceBox: {
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 18,
    marginTop: 2,
    width: 18,
  },
  choiceBoxActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  content: {
    alignSelf: 'center',
    maxWidth: Math.min(layout.maxWidth, 540),
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  emptyQuestionState: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyQuestionText: {
    color: colors.mutedStrong,
    fontSize: type.body,
    lineHeight: 20,
  },
  errorAction: {
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorActionText: {
    color: colors.danger,
    fontSize: type.body,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.body,
  },
  flagCount: {
    color: colors.muted,
    fontSize: type.tiny,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  gazeBackdrop: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  gazeCard: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 88,
    padding: 6,
    width: 92,
  },
  gazeDot: {
    backgroundColor: colors.danger,
    borderRadius: 99,
    height: 6,
    left: '16%',
    position: 'absolute',
    top: '20%',
    width: 6,
  },
  gazeInnerTarget: {
    borderColor: colors.teal,
    borderWidth: 1,
    height: '40%',
    left: '31%',
    position: 'absolute',
    top: '31%',
    width: '40%',
  },
  gazeOuterTarget: {
    borderColor: colors.teal,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: '74%',
    left: '13%',
    position: 'absolute',
    top: '13%',
    width: '74%',
  },
  gazeTag: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: radius.xs,
    borderWidth: 1,
    bottom: 8,
    left: 8,
    minWidth: 28,
    paddingHorizontal: 3,
    position: 'absolute',
  },
  gazeTagText: {
    color: colors.success,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerMeta: {
    color: colors.mutedStrong,
    flex: 1,
    fontFamily: Platform.select({
      android: 'monospace',
      default: undefined,
      ios: 'Courier',
      web: "'Courier New', Courier, monospace",
    }),
    fontSize: type.body,
    letterSpacing: 0.8,
    marginRight: 12,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    marginTop: 2,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...shadow.card,
  },
  loadingText: {
    color: colors.mutedStrong,
    fontSize: type.body,
  },
  metricFill: {
    backgroundColor: colors.teal,
    height: '100%',
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: Platform.select({
      android: 'monospace',
      default: undefined,
      ios: 'Courier',
      web: "'Courier New', Courier, monospace",
    }),
    fontSize: type.tiny,
    letterSpacing: 0.8,
    width: 40,
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metricTrack: {
    backgroundColor: colors.borderSoft,
    flex: 1,
    height: 4,
  },
  metricValue: {
    color: colors.teal,
    fontSize: type.body,
    fontWeight: '700',
    textAlign: 'right',
    width: 46,
  },
  metricsPanel: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '84%',
    ...shadow.card,
  },
  modalCopy: {
    color: colors.mutedStrong,
    fontSize: type.bodyLarge,
    lineHeight: 22,
    marginTop: 10,
  },
  modalCopyStrong: {
    color: colors.text,
    fontWeight: '800',
  },
  modalEyebrow: {
    color: colors.danger,
    fontSize: type.label,
    letterSpacing: 2,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 18, 38, 0.28)',
    flex: 1,
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderColor: colors.teal,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 20,
    paddingVertical: 14,
  },
  modalPrimaryText: {
    color: colors.background,
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 14,
  },
  modalSecondaryText: {
    color: colors.mutedStrong,
    fontSize: type.bodyLarge,
  },
  modalTitle: {
    color: colors.text,
    fontSize: type.display,
    fontWeight: '800',
    marginTop: 10,
  },
  monitorAlert: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monitorAlertText: {
    color: colors.mutedStrong,
    flex: 1,
    fontSize: type.bodyLarge,
    fontWeight: '600',
  },
  monitorAlertTextWarning: {
    color: colors.warning,
  },
  monitorAlertWarning: {
    backgroundColor: colors.warningSoft,
  },
  monitorBadge: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  monitorBadgeGood: {
    backgroundColor: colors.successSoft,
    borderColor: colors.borderStrong,
  },
  monitorBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  monitorBadgeText: {
    color: colors.warning,
    fontSize: type.label,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  monitorBadgeTextGood: {
    color: colors.success,
  },
  monitorBadgeTextPending: {
    color: colors.mutedStrong,
  },
  monitorBadgePending: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
  },
  monitorBadgeWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.borderStrong,
  },
  monitorCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 14,
    ...shadow.card,
  },
  monitorHint: {
    color: colors.mutedStrong,
    fontSize: type.tiny,
    marginTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  monitorStatsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  navigationButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderColor: colors.teal,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  navigationButtonDisabled: {
    opacity: 0.5,
  },
  navigationButtonSecondary: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    flex: 0.46,
  },
  navigationButtonText: {
    color: colors.background,
    fontSize: type.body,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  navigationButtonTextSecondary: {
    color: colors.mutedStrong,
    fontSize: type.body,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  optionCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionCardActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  optionKey: {
    color: colors.muted,
    fontSize: type.bodyLarge,
    fontWeight: '700',
    marginTop: 1,
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: type.bodyLarge,
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsList: {
    gap: 12,
    marginTop: 16,
  },
  permissionButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginHorizontal: 10,
    marginTop: 10,
    paddingVertical: 11,
  },
  permissionButtonText: {
    color: colors.teal,
    fontSize: type.body,
    fontWeight: '700',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  progressBar: {
    backgroundColor: colors.borderSoft,
    height: 2,
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: colors.teal,
    height: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    color: colors.mutedStrong,
    fontFamily: Platform.select({
      android: 'monospace',
      default: undefined,
      ios: 'Courier',
      web: "'Courier New', Courier, monospace",
    }),
    fontSize: type.body,
  },
  question: {
    color: colors.text,
    fontSize: type.title,
    fontWeight: '700',
    lineHeight: 31,
    marginTop: 18,
  },
  questionSection: {
    marginTop: 6,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderColor: colors.teal,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 20,
    paddingVertical: 13,
  },
  submitText: {
    color: colors.background,
    fontSize: type.bodyLarge,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  timerBox: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 76,
    paddingHorizontal: 10,
  },
  timerText: {
    color: colors.teal,
    fontFamily: Platform.select({
      android: 'monospace',
      default: undefined,
      ios: 'Courier',
      web: "'Courier New', Courier, monospace",
    }),
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  });
}
