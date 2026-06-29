import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, type } from '@/constants/design';
import {
  analyzeVideoSummary,
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
const CLIP_SECONDS = 2;
const EVIDENCE_LEAD_SECONDS = 2;
const EVIDENCE_TRAIL_SECONDS = 2;
const SEGMENT_PRUNE_WINDOW_SECONDS = 32;
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
      minBytes: 6144,
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
  if (monitoringMode === 'strict') {
    return {
      maxFrames: 28,
      sampleEveryNFrames: 2,
    };
  }

  if (monitoringMode === 'minimal') {
    return {
      maxFrames: 14,
      sampleEveryNFrames: 4,
    };
  }

  return {
    maxFrames: 20,
    sampleEveryNFrames: 3,
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
  const [flaggedMoments, setFlaggedMoments] = useState(0);
  const [proctoringHandleRevision, setProctoringHandleRevision] = useState(0);

  const cameraRef = useRef<CameraView | null>(null);
  const monitorLoopActiveRef = useRef(false);
  const shouldMonitorRef = useRef(false);
  const isRecordingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const timeoutSubmitTriggeredRef = useRef(false);
  const proctoringHandleRef = useRef<ProctoringSessionHandle | null>(null);
  const heartbeatRefreshBusyRef = useRef(false);
  const lastSuccessfulAnalysisAtRef = useRef<number | null>(null);
  const startupWatchActiveRef = useRef(false);
  const aggregateMetricsRef = useRef(createEmptyAggregateMetrics());
  const recentSegmentsRef = useRef<LocalClipSegment[]>([]);
  const pendingTrailingEvidenceRef = useRef<PendingTrailingEvidence[]>([]);
  const evidenceUploadBlockedRef = useRef(false);

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
    return uploadedSegment;
  }, []);

  const registerRecentSegment = useCallback((segment: LocalClipSegment) => {
    const segmentEndMs = toTimestampMs(segment.endedAtIso) ?? Date.now();
    const pruneBeforeMs = segmentEndMs - SEGMENT_PRUNE_WINDOW_SECONDS * 1000;

    recentSegmentsRef.current = [...recentSegmentsRef.current, segment]
      .filter((candidate) => {
        const candidateEndMs = toTimestampMs(candidate.endedAtIso);
        return candidateEndMs !== null && candidateEndMs >= pruneBeforeMs;
      })
      .sort((left, right) => {
        const leftStart = toTimestampMs(left.startedAtIso) ?? 0;
        const rightStart = toTimestampMs(right.startedAtIso) ?? 0;
        return leftStart - rightStart;
      });
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
          eventStartOffsetSeconds: Number(event.start_timestamp_seconds),
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

      setFlaggedMoments((current) => current + events.length);
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
          return await analyzeVideoSummary(payload);
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
          return analyzeVideoSummary(payload);
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
        summary.events.length > 0
          ? `${summary.events.length} suspicious event(s) flagged in the latest window.`
          : 'Live analysis running. No suspicious activity in the latest window.'
      );
    },
    [persistSuspiciousEvents, registerRecentSegment, resolvePendingTrailingEvidence, sessionData]
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
        minBytes: 6144,
        pollMs: 150,
        stableReads: 3,
        timeoutMs: 6500,
      });
      const durationSeconds = Math.max(
        0.1,
        (new Date(endedAtIso).getTime() - new Date(startedAtIso).getTime()) / 1000
      );

      return {
        durationSeconds,
        endedAtIso,
        startedAtIso,
        uri: recording.uri,
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
            await sleep(320);
            continue;
          }
          setProctoringStatus('error');
          setProctoringMessage(message);
          await sleep(700);
          continue;
        }

        if (!clip) {
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
        }
      }
    } finally {
      monitorLoopActiveRef.current = false;
    }
  }, [processRecordedClip, recordOneClip]);

  const finalizeProctoring = useCallback(
    async (finalStatus: 'submitted' | 'paused' | 'terminated') => {
      shouldMonitorRef.current = false;

      if (isRecordingRef.current) {
        try {
          (cameraRef.current as (CameraView & { stopRecording?: () => void }) | null)?.stopRecording?.();
        } catch {
          // Ignore stop-recording errors during teardown.
        }
      }

      const handle = proctoringHandleRef.current;
      if (!handle) {
        return;
      }

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
      proctoringHandleRef.current = null;
      heartbeatRefreshBusyRef.current = false;
      pendingTrailingEvidenceRef.current = [];
      recentSegmentsRef.current = [];
      evidenceUploadBlockedRef.current = false;
      lastSuccessfulAnalysisAtRef.current = null;

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
    []
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
      setFlaggedMoments(0);
      setCameraReady(false);

      try {
        if (!examId) {
          throw new Error('No exam was selected.');
        }

        const result = await fetchStudentExamSessionData(examId);
        if (!isMounted) {
          return;
        }

        if (result.hasSubmitted) {
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

  const selectOption = (questionId: string, optionId: string) => {
    setSelectedOptions((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = useCallback(async () => {
    if (!sessionData) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await submitStudentExamAnswers({
        answers: sessionData.questions.map((question) => ({
          questionId: question.id,
          selectedOptionId: selectedOptions[question.id] ?? null,
        })),
        examIdInput: sessionData.examId,
      });

      hasSubmittedRef.current = true;
      await finalizeProctoring('submitted');
      setShowConfirm(false);
      router.replace({
        pathname: '/(tabs)/results',
        params: { examId: sessionData.examId },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit exam answers.');
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [finalizeProctoring, selectedOptions, sessionData]);

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
    void handleSubmit();
  }, [errorMessage, handleSubmit, isLoading, isSubmitting, remainingSeconds, sessionData]);

  const cameraStatusTone =
    proctoringStatus === 'error'
      ? '#ef476f'
      : proctoringStatus === 'active'
      ? palette.success
      : palette.warning;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerCode}>{sessionData?.courseCode ?? 'COURSE'}</Text>
            <Text style={styles.headerTitle}>{sessionData?.examTitle ?? 'Exam Session'}</Text>
          </View>
          <View style={styles.timerBox}>
            <Text style={styles.timerText}>{formatCountdown(remainingSeconds)}</Text>
          </View>
        </View>

        {!isLoading && !errorMessage ? (
          <View style={styles.proctoringCard}>
            <View style={styles.proctoringHeader}>
              <View style={[styles.liveDot, { backgroundColor: cameraStatusTone }]} />
              <Text style={[styles.proctoringLabel, { color: cameraStatusTone }]}>
                LIVE ANALYSIS
              </Text>
              <Text style={styles.proctoringFlags}>{flaggedMoments} FLAGGED</Text>
            </View>
            <Text style={styles.proctoringMessage}>{proctoringMessage}</Text>

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
              <Pressable onPress={() => void requestCameraPermission()} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Enable camera for live analysis</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal} size="small" />
            <Text style={styles.loadingText}>Loading exam questions...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.errorAction}>
              <Text style={styles.errorActionText}>Back to dashboard</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !errorMessage && currentQuestion ? (
          <>
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

            <View style={styles.navigationRow}>
              <Pressable
                disabled={questionIndex === 0}
                onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                style={[
                  styles.navigationButton,
                  questionIndex === 0 ? styles.navigationButtonDisabled : null,
                ]}>
                <Text style={styles.navigationButtonText}>Previous</Text>
              </Pressable>

              {questionIndex < totalQuestions - 1 ? (
                <Pressable
                  onPress={() => setQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1))}
                  style={styles.navigationButton}>
                  <Text style={styles.navigationButtonText}>Next</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowConfirm(true)} style={styles.submitButton}>
                  <Text style={styles.submitText}>Submit Exam</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.answerCounter}>
              {answeredCount} of {totalQuestions} questions answered
            </Text>
          </>
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
                <ActivityIndicator color={palette.text} size="small" />
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

const styles = StyleSheet.create({
  answerCounter: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 14,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  cameraPreview: {
    borderColor: '#1c3354',
    borderWidth: 1,
    height: 170,
    marginTop: 12,
    overflow: 'hidden',
  },
  choiceBox: {
    borderColor: palette.border,
    borderWidth: 1,
    height: 18,
    marginTop: 2,
    width: 18,
  },
  choiceBoxActive: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  errorAction: {
    borderColor: '#b34954',
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorActionText: {
    color: '#ff9ea8',
    fontSize: type.body,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2f1116',
    borderColor: '#8f2d37',
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  headerCode: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
    marginTop: 4,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  liveDot: {
    borderRadius: 99,
    height: 7,
    width: 7,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  modalCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '82%',
  },
  modalCopy: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    lineHeight: 22,
    marginTop: 12,
  },
  modalCopyStrong: {
    color: palette.text,
    fontWeight: '800',
  },
  modalEyebrow: {
    color: '#ff5a61',
    fontSize: type.label,
    letterSpacing: 2,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 7, 18, 0.82)',
    flex: 1,
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#f14545',
    marginTop: 20,
    paddingVertical: 14,
  },
  modalPrimaryText: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 14,
  },
  modalSecondaryText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
  },
  modalTitle: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: '800',
    marginTop: 12,
  },
  navigationButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  navigationButtonDisabled: {
    opacity: 0.5,
  },
  navigationButtonText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  optionCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  optionCardActive: {
    borderColor: palette.teal,
  },
  optionKey: {
    color: '#5f7fb0',
    fontSize: type.bodyLarge,
    marginTop: 1,
  },
  optionText: {
    color: palette.text,
    flex: 1,
    fontSize: type.bodyLarge,
    lineHeight: 23,
  },
  optionsList: {
    gap: layout.cardGap,
    marginTop: 16,
  },
  permissionButton: {
    alignItems: 'center',
    borderColor: '#6f92c7',
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: '#9eb4d8',
    fontSize: type.body,
    fontWeight: '700',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  proctoringCard: {
    backgroundColor: '#0a1628',
    borderColor: '#23406a',
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  proctoringFlags: {
    color: '#9fb7da',
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginLeft: 'auto',
  },
  proctoringHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  proctoringLabel: {
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  proctoringMessage: {
    color: '#9cb6d8',
    fontSize: type.body,
    marginTop: 8,
  },
  progressBar: {
    backgroundColor: '#213457',
    height: 2,
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: palette.teal,
    height: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  progressLabel: {
    color: '#7b97c5',
    fontSize: 11,
  },
  question: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '800',
    lineHeight: 26,
    marginTop: 18,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    borderColor: '#0bba70',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submitText: {
    color: '#1df886',
    fontSize: type.bodyLarge,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  timerBox: {
    alignItems: 'center',
    borderColor: palette.teal,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: 8,
  },
  timerText: {
    color: palette.teal,
    fontSize: type.title,
    fontWeight: '800',
  },
});
