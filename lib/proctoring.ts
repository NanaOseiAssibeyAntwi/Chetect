import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type MonitoringMode = 'standard' | 'strict' | 'minimal';
type SessionStatus = 'pending' | 'active' | 'paused' | 'submitted' | 'completed' | 'terminated';
type AnalysisLabel = 'NO_FACE' | 'NORMAL' | 'CAUTION' | 'SUSPICIOUS';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

type ProfileRow = {
  id: string;
  institutional_id: string | null;
  role: 'student' | 'invigilator' | 'admin';
};

type RegistrationRow = {
  id: string;
};

type AnalysisSessionRow = {
  backend_session_id: string | null;
  id: string;
  started_at: string;
  student_id: string;
};

type InsertedSuspiciousEventRow = {
  id: string;
};

export type DetectorVideoEvent = {
  duration_seconds?: number;
  end_frame_index: number;
  end_timestamp_seconds: number;
  frame_count: number;
  label: string;
  max_score: number | null;
  reason: string;
  severity?: string | null;
  signal_code?: string | null;
  start_frame_index: number;
  start_timestamp_seconds: number;
};

type DetectorVideoAlert = {
  duration_seconds?: number;
  end_timestamp_seconds: number;
  label: string;
  reason: string;
  severity?: string | null;
  signal_code?: string | null;
  start_timestamp_seconds: number;
};

export type DetectorVideoSummary = {
  average_score: number;
  alerts: DetectorVideoAlert[];
  detections: number;
  duration_seconds: number;
  events: DetectorVideoEvent[];
  filename: string;
  final_label: string;
  fps: number;
  frames_processed: number;
  frames_sampled: number;
  key_frames: {
    frame_index: number;
    label: string;
    observations: string[];
    score: number | null;
    timestamp_seconds: number;
  }[];
  max_score: number;
  session_id: string | null;
  suspicious_event_count: number;
};

type DetectorVideoFrameResult = {
  frame_index: number;
  label: string;
  observations: string[];
  score: number | null;
  timestamp_seconds: number;
};

type DetectorVideoAnalysisResponse = Omit<DetectorVideoSummary, 'key_frames'> & {
  alerts?: DetectorVideoAlert[];
  frame_results: DetectorVideoFrameResult[];
};

type DetectorAnalyzeRequestParams = {
  aiSessionId?: string | null;
  clipUri: string;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
};
type NativeVideoUploadMode = 'uri' | 'blob';
type QueuedWebSocketChunk = {
  clipUri: string;
  contentType: string;
  filename: string;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
  sequence: number;
};

type InFlightWebSocketChunk = {
  filename: string;
  maxKeyFrames: number;
  sentAtMs: number;
  timeout: ReturnType<typeof setTimeout>;
};

export type ProctoringSessionHandle = {
  aiSessionId: string | null;
  analysisSessionId: string;
  examId: string;
  startedAtIso: string;
  studentId: string;
};

export type ProctoringAggregateMetrics = {
  averageScore: number;
  detections: number;
  finalLabel: AnalysisLabel;
  framesProcessed: number;
  framesSampled: number;
  latestObservation: string;
  maxScore: number;
  suspiciousEventCount: number;
};

export type SuspiciousEvidenceSegment = {
  durationSeconds: number;
  endedAtIso: string;
  path: string;
  publicUrl: string | null;
  startedAtIso: string;
};

export type SuspiciousEventEvidence = {
  ai: {
    detectorSessionId: string | null;
    durationSeconds: number;
    eventEndOffsetSeconds: number;
    eventDurationSeconds: number;
    eventStartOffsetSeconds: number;
    severity: string | null;
    signalCode: string | null;
  };
  clipBundleVersion: number;
  requestedLeadSeconds: number;
  requestedTrailSeconds: number;
  segments: SuspiciousEvidenceSegment[];
  wasTruncated: boolean;
  windowEndIso: string;
  windowStartIso: string;
};

export type InsertSuspiciousEventInput = {
  analysisSessionId: string;
  endFrameIndex: number;
  endTimestampSeconds: number;
  evidence: SuspiciousEventEvidence;
  examId: string;
  frameCount: number;
  label: AnalysisLabel;
  maxScore: number | null;
  reason: string;
  riskLevel: RiskLevel;
  source?: string;
  startFrameIndex: number;
  startTimestampSeconds: number;
  studentId: string;
};

export const SUSPICIOUS_CLIP_BUCKET = 'suspiciousVideos';

const ANALYSIS_LABEL_WEIGHT: Record<AnalysisLabel, number> = {
  CAUTION: 2,
  NORMAL: 1,
  NO_FACE: 3,
  SUSPICIOUS: 4,
};
const DEFAULT_DETECTOR_BASE_URL = 'https://rg-cheating-detector-fghefkddd9chh3ch.eastus-01.azurewebsites.net';
const DEFAULT_DETECTOR_WEBSOCKET_URL =
  'wss://websocketforchetect-g2ckhweeere5brc2.canadacentral-01.azurewebsites.net/ws/analyze';
const DEFAULT_WEBSOCKET_MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const WEBSOCKET_ANALYSIS_TIMEOUT_MS = 60_000;
const WEBSOCKET_CONNECT_TIMEOUT_MS = 20_000;
const WEBSOCKET_MAX_QUEUE_LENGTH = 3;
const WEBSOCKET_PING_INTERVAL_MS = 25_000;
const WS_OPEN = 1;
let detectorSummaryEndpointUnsupported = false;
let resolvedDetectorBaseUrl = '';

function normalizeBaseUrl(urlInput: string) {
  const trimmed = String(urlInput ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const compact = trimmed.replace(/\s+/g, '');
  const protocolMatch = compact.match(/^([a-z]+):\/\//i);
  const protocol = (protocolMatch?.[1] ?? 'http').toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') {
    return '';
  }

  const remainder = protocolMatch ? compact.slice(protocolMatch[0].length) : compact;
  const authorityAndPath = remainder.split(/[?#]/)[0] ?? '';
  const slashIndex = authorityAndPath.indexOf('/');
  const authority = slashIndex >= 0 ? authorityAndPath.slice(0, slashIndex) : authorityAndPath;
  const normalizedPath =
    slashIndex >= 0 ? authorityAndPath.slice(slashIndex).replace(/\/+$/, '') : '';
  if (!authority) {
    return '';
  }

  const pathSuffix = normalizedPath && normalizedPath !== '/' ? normalizedPath : '';
  return `${protocol}://${authority}${pathSuffix}`;
}

function normalizeDetectorBaseUrl(urlInput: string) {
  return normalizeBaseUrl(urlInput).replace(/\/api\/v1\/?$/i, '');
}

function normalizeDetectorWebSocketUrl(urlInput: string) {
  const trimmed = String(urlInput ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const compact = trimmed.replace(/\s+/g, '');
  const protocolMatch = compact.match(/^([a-z]+):\/\//i);
  const rawProtocol = (protocolMatch?.[1] ?? 'wss').toLowerCase();
  const protocol =
    rawProtocol === 'https' ? 'wss' : rawProtocol === 'http' ? 'ws' : rawProtocol;
  if (protocol !== 'ws' && protocol !== 'wss') {
    return '';
  }

  const remainder = protocolMatch ? compact.slice(protocolMatch[0].length) : compact;
  const authorityAndPath = remainder.split(/[?#]/)[0] ?? '';
  const slashIndex = authorityAndPath.indexOf('/');
  const authority = slashIndex >= 0 ? authorityAndPath.slice(0, slashIndex) : authorityAndPath;
  const path = slashIndex >= 0 ? authorityAndPath.slice(slashIndex).replace(/\/+$/, '') : '';
  if (!authority) {
    return '';
  }

  return `${protocol}://${authority}${path || '/ws/analyze'}`;
}

function parseExpoHostForDetector() {
  const extractHost = (input: unknown) => {
    const trimmed = String(input ?? '').trim();
    if (!trimmed) {
      return '';
    }

    const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//i, '');
    const authority = withoutProtocol.split('/')[0] ?? '';
    return authority.split(':')[0]?.trim() ?? '';
  };

  const expoHost = extractHost(Constants.expoConfig?.hostUri);
  if (expoHost) {
    return expoHost;
  }

  const expoGoDebuggerHost = extractHost(
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost
  );
  if (expoGoDebuggerHost) {
    return expoGoDebuggerHost;
  }

  const manifest2Host = extractHost(
    (
      Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }
    ).manifest2?.extra?.expoClient?.hostUri
  );
  if (manifest2Host) {
    return manifest2Host;
  }

  const legacyDebuggerHost = extractHost(
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost
  );
  if (legacyDebuggerHost) {
    return legacyDebuggerHost;
  }

  return '';
}

function isIpv4Address(value: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}

function isLikelyLocalNetworkHost(hostInput: string) {
  const host = hostInput.trim().toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return false;
  }

  if (host.endsWith('.local')) {
    return true;
  }

  return isIpv4Address(host);
}

function deriveDetectorFallbackBaseUrl() {
  const expoHost = parseExpoHostForDetector();
  if (isLikelyLocalNetworkHost(expoHost)) {
    return `http://${expoHost}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://127.0.0.1:8000';
}

function inferVideoMimeTypeFromExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  if (normalized === '.mov') {
    return 'video/quicktime';
  }
  if (normalized === '.webm') {
    return 'video/webm';
  }
  if (normalized === '.avi') {
    return 'video/x-msvideo';
  }
  if (normalized === '.3gp' || normalized === '.3g2') {
    return 'video/3gpp';
  }
  return 'video/mp4';
}

function inferVideoExtensionFromUri(clipUri: string) {
  const clipUriWithoutQuery = String(clipUri ?? '').split('?')[0] ?? '';
  const dotIndexInUri = clipUriWithoutQuery.lastIndexOf('.');
  const extensionFromUri =
    dotIndexInUri >= 0 ? clipUriWithoutQuery.slice(dotIndexInUri).trim().toLowerCase() : '';

  if (['.mp4', '.mov', '.webm', '.avi', '.3gp', '.3g2'].includes(extensionFromUri)) {
    return extensionFromUri;
  }

  return '.mp4';
}

function decodeBase64ToArrayBuffer(base64Input: string) {
  const normalizedBase64 = base64Input.replace(/\s+/g, '');

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalizedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleanBase64 = normalizedBase64.replace(/=+$/, '');
  const outputLength = Math.floor((cleanBase64.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let byteIndex = 0;

  for (let index = 0; index < cleanBase64.length; index += 1) {
    const value = alphabet.indexOf(cleanBase64[index]);
    if (value < 0) {
      throw new Error('Suspicious clip segment contained invalid base64 data.');
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      if (byteIndex < bytes.length) {
        bytes[byteIndex] = (buffer >> bits) & 0xff;
        byteIndex += 1;
      }
    }
  }

  if (byteIndex <= 0) {
    throw new Error('Suspicious clip segment upload payload was empty.');
  }

  return bytes.buffer.slice(0, byteIndex);
}

async function readLocalFileAsArrayBuffer(fileUri: string) {
  const info = await FileSystem.getInfoAsync(fileUri);
  const fileSize = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || info.isDirectory || fileSize <= 0) {
    throw new Error('Suspicious clip segment file is empty or missing.');
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('Suspicious clip segment file could not be read for upload.');
  }

  return decodeBase64ToArrayBuffer(base64);
}

function rewriteLoopbackConfiguredBaseUrl(configuredUrl: string) {
  const normalized = normalizeDetectorBaseUrl(configuredUrl);
  if (!normalized) {
    return normalized;
  }

  const protocolSplit = normalized.split('://');
  const hasProtocol = protocolSplit.length > 1;
  const protocol = hasProtocol ? protocolSplit[0] : 'http';
  const remainder = hasProtocol ? protocolSplit.slice(1).join('://') : normalized;
  const slashIndex = remainder.indexOf('/');
  const authority = slashIndex >= 0 ? remainder.slice(0, slashIndex) : remainder;
  const suffix = slashIndex >= 0 ? remainder.slice(slashIndex) : '';

  if (!authority) {
    return normalized;
  }

  const colonIndex = authority.indexOf(':');
  const host = (colonIndex >= 0 ? authority.slice(0, colonIndex) : authority).trim().toLowerCase();
  const port = colonIndex >= 0 ? authority.slice(colonIndex + 1).trim() : '';

  if (host !== 'localhost' && host !== '127.0.0.1') {
    return normalized;
  }

  const expoHost = parseExpoHostForDetector();
  let reachableHost = '';
  if (isLikelyLocalNetworkHost(expoHost)) {
    reachableHost = expoHost;
  } else if (Platform.OS === 'android') {
    reachableHost = '10.0.2.2';
  } else {
    return normalized;
  }

  const normalizedPort = port || '8000';
  return `${protocol}://${reachableHost}:${normalizedPort}${suffix}`;
}

function getConfiguredDetectorBaseUrl() {
  const configured =
    process.env.EXPO_PUBLIC_CHEATING_DETECTOR_URL ??
    process.env.EXPO_PUBLIC_CHEATING_DETECTOR_API_URL ??
    '';
  if (configured.trim()) {
    return rewriteLoopbackConfiguredBaseUrl(configured);
  }

  return '';
}

function getDetectorBaseUrlCandidates() {
  const candidates: string[] = [];

  const pushCandidate = (value: string) => {
    const normalized = normalizeDetectorBaseUrl(value);
    if (!normalized) {
      return;
    }

    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(resolvedDetectorBaseUrl);
  pushCandidate(getConfiguredDetectorBaseUrl());
  pushCandidate(DEFAULT_DETECTOR_BASE_URL);

  return candidates;
}

function setResolvedDetectorBaseUrl(baseUrl: string) {
  resolvedDetectorBaseUrl = normalizeDetectorBaseUrl(baseUrl);
}

function isLikelyNetworkFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return /network request failed|failed to fetch|econn|enotfound|socket|abort|timeout|timed out|load failed|refused/i.test(
    message
  );
}

function buildDetectorReachabilityError(endpointPath: string, candidates: string[]) {
  const attempted = candidates
    .map((baseUrl) => `${baseUrl}${endpointPath}`)
    .join(', ');
  return new Error(
    `Unable to reach detector service. Tried: ${attempted}. Confirm EXPO_PUBLIC_CHEATING_DETECTOR_URL is set to the deployed Chetect model endpoint and restart Expo so the latest env value is loaded.`
  );
}

async function fetchDetectorAcrossCandidates(params: {
  endpointPath: string;
  retryStatusCodes?: number[];
  request: (baseUrl: string) => Promise<Response>;
}) {
  const candidates = getDetectorBaseUrlCandidates();
  let lastRetriableResponse: Response | null = null;

  for (const baseUrl of candidates) {
    try {
      const response = await params.request(baseUrl);
      setResolvedDetectorBaseUrl(baseUrl);

      if (params.retryStatusCodes?.includes(response.status)) {
        lastRetriableResponse = response;
        continue;
      }

      return {
        baseUrl,
        response,
      };
    } catch (error) {
      if (!isLikelyNetworkFailure(error)) {
        throw error;
      }
    }
  }

  if (lastRetriableResponse) {
    return {
      baseUrl: '',
      response: lastRetriableResponse,
    };
  }

  throw buildDetectorReachabilityError(params.endpointPath, candidates);
}

export function getDetectorBaseUrl() {
  return getDetectorBaseUrlCandidates()[0] ?? DEFAULT_DETECTOR_BASE_URL;
}

export function getDetectorWebSocketUrl() {
  return (
    normalizeDetectorWebSocketUrl(
      process.env.EXPO_PUBLIC_CHEATING_DETECTOR_WS_URL ??
        process.env.EXPO_PUBLIC_CHEATING_DETECTOR_WEBSOCKET_URL ??
        ''
    ) || DEFAULT_DETECTOR_WEBSOCKET_URL
  );
}

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeSuspiciousEventCount(value: unknown) {
  return Math.max(0, Math.trunc(toNumber(value)));
}

function resolveSuspiciousEventCount(value: unknown, fallbackCount: number) {
  const normalizedFallback = Math.max(0, Math.trunc(fallbackCount));

  if (value === null || value === undefined || String(value).trim() === '') {
    return normalizedFallback;
  }

  return Math.max(normalizeSuspiciousEventCount(value), normalizedFallback);
}

function toAnalysisLabel(value: unknown): AnalysisLabel {
  const label = String(value ?? '')
    .trim()
    .toUpperCase();
  if (label === 'SUSPICIOUS') {
    return 'SUSPICIOUS';
  }

  if (label === 'CAUTION') {
    return 'CAUTION';
  }

  if (label === 'NORMAL') {
    return 'NORMAL';
  }

  return 'NO_FACE';
}

function normalizeObservationText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .replace(/[.;,\s]+$/, '')
    .trim();
}

export function buildDetectorObservationSummary(
  summary: Pick<DetectorVideoSummary, 'alerts' | 'events' | 'key_frames'>,
  maxItems = 3,
  options?: {
    includeAlertReasons?: boolean;
    includeKeyFrameObservations?: boolean;
  }
) {
  const includeAlertReasons = options?.includeAlertReasons ?? false;
  const includeKeyFrameObservations = options?.includeKeyFrameObservations ?? false;
  const sanitizedMaxItems = Math.max(1, Math.trunc(maxItems));
  const rankedReasons = new Map<string, { count: number; firstSeenIndex: number; text: string }>();
  let seenIndex = 0;

  const registerReason = (rawReason: unknown) => {
    const normalized = normalizeObservationText(rawReason);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    const current = rankedReasons.get(key);
    if (current) {
      current.count += 1;
      return;
    }

    rankedReasons.set(key, {
      count: 1,
      firstSeenIndex: seenIndex,
      text: normalized,
    });
    seenIndex += 1;
  };

  for (const event of summary.events ?? []) {
    registerReason(event.reason);
  }

  if (includeAlertReasons) {
    for (const alert of summary.alerts ?? []) {
      registerReason(alert.reason);
    }
  }

  if (includeKeyFrameObservations) {
    for (const keyFrame of summary.key_frames ?? []) {
      for (const observation of keyFrame.observations ?? []) {
        registerReason(observation);
      }
    }
  }

  return Array.from(rankedReasons.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.firstSeenIndex - right.firstSeenIndex;
    })
    .slice(0, sanitizedMaxItems)
    .map((item) => item.text)
    .join('; ');
}

function toRiskLevel(value: number | null | undefined): RiskLevel {
  const score = toNumber(value);
  if (score >= 90) {
    return 'critical';
  }

  if (score >= 75) {
    return 'high';
  }

  if (score >= 45) {
    return 'medium';
  }

  return 'low';
}

export function createEmptyAggregateMetrics(): ProctoringAggregateMetrics {
  return {
    averageScore: 0,
    detections: 0,
    finalLabel: 'NO_FACE',
    framesProcessed: 0,
    framesSampled: 0,
    latestObservation: '',
    maxScore: 0,
    suspiciousEventCount: 0,
  };
}

export function mergeAggregateMetrics(
  current: ProctoringAggregateMetrics,
  summary: DetectorVideoSummary
): ProctoringAggregateMetrics {
  const nextFramesProcessed = current.framesProcessed + Math.max(0, toNumber(summary.frames_processed));
  const nextFramesSampled = current.framesSampled + Math.max(0, toNumber(summary.frames_sampled));
  const nextDetections = current.detections + Math.max(0, toNumber(summary.detections));
  const nextSuspiciousCount =
    current.suspiciousEventCount + resolveSuspiciousEventCount(summary.suspicious_event_count, summary.events.length);
  const nextMaxScore = Math.max(current.maxScore, Math.max(0, toNumber(summary.max_score)));

  const currentWeighted = current.averageScore * current.framesSampled;
  const summaryWeighted = toNumber(summary.average_score) * Math.max(0, toNumber(summary.frames_sampled));
  const nextAverage =
    nextFramesSampled > 0 ? Number(((currentWeighted + summaryWeighted) / nextFramesSampled).toFixed(2)) : 0;

  const summaryLabel = toAnalysisLabel(summary.final_label);
  const nextFinalLabel =
    current.framesSampled === 0 ||
    ANALYSIS_LABEL_WEIGHT[summaryLabel] >= ANALYSIS_LABEL_WEIGHT[current.finalLabel]
      ? summaryLabel
      : current.finalLabel;

  const summaryObservation = buildDetectorObservationSummary(summary, 3, {
    includeAlertReasons: true,
    includeKeyFrameObservations: true,
  });
  const nextObservation = summaryObservation || current.latestObservation;

  return {
    averageScore: nextAverage,
    detections: nextDetections,
    finalLabel: nextFinalLabel,
    framesProcessed: nextFramesProcessed,
    framesSampled: nextFramesSampled,
    latestObservation: nextObservation,
    maxScore: nextMaxScore,
    suspiciousEventCount: nextSuspiciousCount,
  };
}

async function getCurrentStudentProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in. Please sign in again.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, institutional_id')
    .eq('id', user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw new Error('Unable to load your student profile.');
  }

  if (profile.role !== 'student') {
    throw new Error('Only student accounts can start live proctoring.');
  }

  return profile;
}

async function ensureAuthenticatedStorageUploadUser() {
  let sessionResult: Awaited<ReturnType<typeof supabase.auth.getSession>>;
  try {
    sessionResult = await supabase.auth.getSession();
  } catch (error) {
    throw new Error(
      `Unable to verify your sign-in session for suspicious clip upload: ${
        error instanceof Error ? error.message : 'Network request failed.'
      }`
    );
  }

  const { data: sessionData, error: sessionError } = sessionResult;
  if (sessionError) {
    throw new Error('Unable to verify your sign-in session for suspicious clip upload.');
  }

  const expiresAtSeconds = Number(sessionData.session?.expires_at ?? 0);
  const refreshToken = String(sessionData.session?.refresh_token ?? '').trim();
  const expiresSoon =
    expiresAtSeconds > 0 && expiresAtSeconds * 1000 <= Date.now() + 60_000;

  if (refreshToken && expiresSoon) {
    let refreshResult: Awaited<ReturnType<typeof supabase.auth.refreshSession>>;
    try {
      refreshResult = await supabase.auth.refreshSession();
    } catch (error) {
      throw new Error(
        `Your sign-in session could not be refreshed for suspicious clip upload: ${
          error instanceof Error ? error.message : 'Network request failed.'
        }`
      );
    }

    const { data: refreshedData, error: refreshError } = refreshResult;
    if (refreshError || !refreshedData.session) {
      throw new Error(
        'Your sign-in session expired before the suspicious clip upload. Sign in again and restart the exam session.'
      );
    }
  }

  let userResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    userResult = await supabase.auth.getUser();
  } catch (error) {
    throw new Error(
      `Unable to confirm your sign-in session for suspicious clip upload: ${
        error instanceof Error ? error.message : 'Network request failed.'
      }`
    );
  }

  const {
    data: { user },
    error: userError,
  } = userResult;

  if (userError || !user) {
    throw new Error(
      'Your sign-in session is missing for suspicious clip upload. Sign in again and restart the exam session.'
    );
  }

  return user;
}

export async function createDetectorSession() {
  const { baseUrl, response } = await fetchDetectorAcrossCandidates({
    endpointPath: '/api/v1/sessions',
    request: async (candidateBaseUrl) =>
      fetch(`${candidateBaseUrl}/api/v1/sessions`, {
        method: 'POST',
      }),
  });

  if (!response.ok) {
    throw new Error(`Detector session failed (${response.status}) at ${baseUrl || getDetectorBaseUrl()}.`);
  }

  const payload = (await response.json()) as { session_id?: string };
  const sessionId = String(payload.session_id ?? '').trim();
  if (!sessionId) {
    throw new Error('Detector session did not return a session id.');
  }

  return sessionId;
}

export async function deleteDetectorSession(sessionId: string | null | undefined) {
  const normalized = String(sessionId ?? '').trim();
  if (!normalized) {
    return;
  }

  try {
    await fetchDetectorAcrossCandidates({
      endpointPath: `/api/v1/sessions/${encodeURIComponent(normalized)}`,
      request: async (candidateBaseUrl) =>
        fetch(`${candidateBaseUrl}/api/v1/sessions/${encodeURIComponent(normalized)}`, {
          method: 'DELETE',
        }),
    });
  } catch {
    // Do not block the exam flow when detector cleanup fails.
  }
}

async function buildAnalyzeVideoFormData(params: {
  aiSessionId?: string | null;
  clipUri: string;
  includeMaxKeyFramesField: boolean;
  includeLandmarksField: boolean;
  nativeUploadMode?: NativeVideoUploadMode;
  includeSamplingFields?: boolean;
  includeSessionIdField?: boolean;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
}) {
  const form = new FormData();
  const clipUriWithoutQuery = params.clipUri.split('?')[0] ?? '';
  const dotIndexInUri = clipUriWithoutQuery.lastIndexOf('.');
  const extensionFromUri =
    dotIndexInUri >= 0 ? clipUriWithoutQuery.slice(dotIndexInUri).trim().toLowerCase() : '';
  const hasValidUriExtension = /^[.][a-z0-9]{2,5}$/i.test(extensionFromUri);
  const extension = hasValidUriExtension ? extensionFromUri : '.mp4';
  const filename = `segment-${Date.now()}${extension}`;
  const mimeType = inferVideoMimeTypeFromExtension(extension);

  if (Platform.OS === 'web') {
    const clipResponse = await fetch(params.clipUri);
    if (!clipResponse.ok) {
      throw new Error('Unable to read recorded clip for detector upload.');
    }

    const clipBlob = await clipResponse.blob();
    form.append('video', clipBlob, filename);
  } else {
    const nativeUploadMode = params.nativeUploadMode ?? 'uri';
    if (nativeUploadMode === 'blob') {
      const clipResponse = await fetch(params.clipUri);
      if (!clipResponse.ok) {
        throw new Error('Unable to read recorded clip for fallback detector upload.');
      }

      const clipBlob = await clipResponse.blob();
      form.append('video', clipBlob, filename);
    } else {
      form.append('video', {
        name: filename,
        type: mimeType,
        uri: params.clipUri,
      } as unknown as Blob);
    }
  }

  if (params.includeSamplingFields !== false) {
    form.append('sample_every_n_frames', String(Math.max(1, Math.trunc(params.sampleEveryNFrames))));
    form.append('max_frames', String(Math.max(1, Math.trunc(params.maxFrames))));
  }
  if (params.includeMaxKeyFramesField) {
    form.append('max_key_frames', String(Math.max(1, Math.trunc(params.maxKeyFrames))));
  }

  if (params.includeSessionIdField !== false) {
    const aiSessionId = String(params.aiSessionId ?? '').trim();
    if (aiSessionId) {
      form.append('session_id', aiSessionId);
    }
  }

  if (params.includeLandmarksField) {
    form.append('include_landmarks', 'false');
  }

  return form;
}

async function getDetectorErrorDetail(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    const detail = payload?.detail;
    if (typeof detail === 'string') {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }

          const message = (item as { msg?: unknown }).msg;
          const rawLocation = (item as { loc?: unknown }).loc;
          const location =
            Array.isArray(rawLocation) &&
            rawLocation
              .map((part) => String(part ?? '').trim())
              .filter(Boolean)
              .join('.');
          if (typeof message === 'string' && message.trim()) {
            if (location) {
              return `${message.trim()} (${location})`;
            }
            return message.trim();
          }

          return '';
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join('; ');
      }
    }
  } catch {
    // fall through to generic fallback message
  }

  return '';
}

function summarizeVideoAnalysisPayload(
  analysisPayload: DetectorVideoAnalysisResponse,
  maxKeyFrames: number
): DetectorVideoSummary {
  const rankedFrames = [...(analysisPayload.frame_results ?? [])].sort((left, right) => {
    const leftScore = toNumber(left.score);
    const rightScore = toNumber(right.score);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return toNumber(right.timestamp_seconds) - toNumber(left.timestamp_seconds);
  });

  const keyFrames = rankedFrames.slice(0, Math.max(1, Math.trunc(maxKeyFrames))).map((frame) => ({
    frame_index: frame.frame_index,
    label: frame.label,
    observations: frame.observations ?? [],
    score: frame.score,
    timestamp_seconds: frame.timestamp_seconds,
  }));

  const normalizedAlerts = (analysisPayload.alerts ?? []).map((alert, index) => ({
    duration_seconds:
      typeof alert.duration_seconds === 'number' && Number.isFinite(alert.duration_seconds)
        ? Math.max(0, alert.duration_seconds)
        : Math.max(
            0,
            toNumber(alert.end_timestamp_seconds) - toNumber(alert.start_timestamp_seconds)
          ),
    end_frame_index: 0,
    end_timestamp_seconds: toNumber(alert.end_timestamp_seconds),
    frame_count: 0,
    label: String(alert.label ?? 'SUSPICIOUS').trim().toUpperCase(),
    max_score: null,
    reason: String(alert.reason ?? '').trim() || 'Suspicious behavior detected.',
    severity: String(alert.severity ?? '').trim() || null,
    signal_code: String(alert.signal_code ?? '').trim() || null,
    start_frame_index: index,
    start_timestamp_seconds: toNumber(alert.start_timestamp_seconds),
  }));

  const normalizedEvents = (analysisPayload.events ?? []).map((event, index) => ({
    duration_seconds:
      typeof event.duration_seconds === 'number' && Number.isFinite(event.duration_seconds)
        ? Math.max(0, event.duration_seconds)
        : Math.max(
            0,
            toNumber(event.end_timestamp_seconds) - toNumber(event.start_timestamp_seconds)
          ),
    end_frame_index: Math.max(0, Math.trunc(toNumber(event.end_frame_index))),
    end_timestamp_seconds: toNumber(event.end_timestamp_seconds),
    frame_count: Math.max(0, Math.trunc(toNumber(event.frame_count))),
    label: String(event.label ?? 'SUSPICIOUS').trim().toUpperCase(),
    max_score:
      event.max_score === null || event.max_score === undefined ? null : toNumber(event.max_score),
    reason: String(event.reason ?? '').trim() || 'Suspicious behavior detected.',
    severity: String(event.severity ?? '').trim() || null,
    signal_code: String(event.signal_code ?? '').trim() || null,
    start_frame_index:
      Number.isFinite(toNumber(event.start_frame_index)) && toNumber(event.start_frame_index) > 0
        ? Math.max(0, Math.trunc(toNumber(event.start_frame_index)))
        : index,
    start_timestamp_seconds: toNumber(event.start_timestamp_seconds),
  }));

  return {
    average_score: analysisPayload.average_score,
    alerts: normalizedAlerts,
    detections: analysisPayload.detections,
    duration_seconds: analysisPayload.duration_seconds,
    events: normalizedEvents,
    filename: analysisPayload.filename,
    final_label: analysisPayload.final_label,
    fps: analysisPayload.fps,
    frames_processed: analysisPayload.frames_processed,
    frames_sampled: analysisPayload.frames_sampled,
    key_frames: keyFrames,
    max_score: analysisPayload.max_score,
    session_id: analysisPayload.session_id,
    suspicious_event_count: resolveSuspiciousEventCount(
      analysisPayload.suspicious_event_count,
      normalizedEvents.length
    ),
  };
}

async function postAnalyzeWithCompatibility(params: {
  endpointPath: '/api/v1/analyze/video' | '/api/v1/analyze/video/summary';
  includeMaxKeyFramesField: boolean;
  includeLandmarksField: boolean;
  nativeUploadMode?: NativeVideoUploadMode;
  request: DetectorAnalyzeRequestParams;
}) {
  const { response } = await fetchDetectorAcrossCandidates({
    endpointPath: params.endpointPath,
    request: async (candidateBaseUrl) => {
      const formData = await buildAnalyzeVideoFormData({
        ...params.request,
        includeLandmarksField: params.includeLandmarksField,
        includeMaxKeyFramesField: params.includeMaxKeyFramesField,
        nativeUploadMode: params.nativeUploadMode,
        includeSamplingFields: true,
        includeSessionIdField: true,
      });

      return fetch(`${candidateBaseUrl}${params.endpointPath}`, {
        body: formData,
        method: 'POST',
      });
    },
  });

  return response;
}

function isLikelyInvalidUploadedVideoDetail(detail: string) {
  const normalized = detail.trim().toLowerCase();
  return /uploaded file is not a valid video|moov atom|could not read any frames from the uploaded video/.test(
    normalized
  );
}

async function postAnalyzeWithNativeUploadFallback(params: {
  endpointPath: '/api/v1/analyze/video' | '/api/v1/analyze/video/summary';
  includeMaxKeyFramesField: boolean;
  includeLandmarksField: boolean;
  request: DetectorAnalyzeRequestParams;
}) {
  const primaryResponse = await postAnalyzeWithCompatibility({
    ...params,
    nativeUploadMode: 'uri',
  });

  if (Platform.OS === 'web' || primaryResponse.ok) {
    return primaryResponse;
  }

  const detail = await getDetectorErrorDetail(primaryResponse.clone());
  if (!isLikelyInvalidUploadedVideoDetail(detail)) {
    return primaryResponse;
  }

  return postAnalyzeWithCompatibility({
    ...params,
    nativeUploadMode: 'blob',
  });
}

export async function analyzeVideoSummary(params: {
  aiSessionId?: string | null;
  clipUri: string;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
}) {
  if (!detectorSummaryEndpointUnsupported) {
    const summaryResponse = await postAnalyzeWithNativeUploadFallback({
      endpointPath: '/api/v1/analyze/video/summary',
      includeLandmarksField: false,
      includeMaxKeyFramesField: true,
      request: params,
    });

    if (summaryResponse.ok) {
      const payload = (await summaryResponse.json()) as DetectorVideoSummary & {
        alerts?: DetectorVideoAlert[];
      };
      if (Array.isArray(payload.key_frames) && Array.isArray(payload.events)) {
        return {
          ...payload,
          alerts: Array.isArray(payload.alerts) ? payload.alerts : [],
          suspicious_event_count: resolveSuspiciousEventCount(
            payload.suspicious_event_count,
            payload.events.length
          ),
        };
      }

      return summarizeVideoAnalysisPayload(
        payload as unknown as DetectorVideoAnalysisResponse,
        params.maxKeyFrames
      );
    }

    const summaryDetail = await getDetectorErrorDetail(summaryResponse);
    if (summaryResponse.status !== 404 && summaryResponse.status !== 405) {
      throw new Error(summaryDetail || `Detector rejected the video summary request (${summaryResponse.status}).`);
    }

    detectorSummaryEndpointUnsupported = true;
  }

  const videoResponse = await postAnalyzeWithNativeUploadFallback({
    endpointPath: '/api/v1/analyze/video',
    includeLandmarksField: true,
    includeMaxKeyFramesField: false,
    request: params,
  });

  if (!videoResponse.ok) {
    const videoDetail = await getDetectorErrorDetail(videoResponse);
    throw new Error(videoDetail || `Detector rejected the video analysis request (${videoResponse.status}).`);
  }

  const payload = (await videoResponse.json()) as DetectorVideoAnalysisResponse;
  return summarizeVideoAnalysisPayload(payload, params.maxKeyFrames);
}

function getConfiguredWebSocketMaxChunkBytes() {
  const configured = Number(process.env.EXPO_PUBLIC_CHEATING_DETECTOR_WS_MAX_BYTES);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }

  return DEFAULT_WEBSOCKET_MAX_CHUNK_BYTES;
}

async function getLocalVideoChunkBytes(clipUri: string) {
  if (Platform.OS === 'web') {
    let response: Response;
    try {
      response = await fetch(clipUri);
    } catch (error) {
      throw new Error(
        `Unable to read recorded clip for WebSocket upload: ${
          error instanceof Error ? error.message : 'Network request failed.'
        }`
      );
    }

    if (!response.ok) {
      throw new Error('Unable to read recorded clip for WebSocket upload.');
    }

    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to convert recorded clip to base64.'));
      reader.onloadend = () => {
        const result = String(reader.result ?? '');
        const [, encoded] = result.split(',', 2);
        if (!encoded) {
          reject(new Error('Recorded clip base64 payload was empty.'));
          return;
        }

        resolve(encoded);
      };
      reader.readAsDataURL(blob);
    });

    return {
      base64,
      size: blob.size,
    };
  }

  const info = await FileSystem.getInfoAsync(clipUri);
  const size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || info.isDirectory || size <= 0) {
    throw new Error('Recorded clip is empty or missing.');
  }

  const base64 = await FileSystem.readAsStringAsync(clipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) {
    throw new Error('Recorded clip base64 payload was empty.');
  }

  return {
    base64,
    size,
  };
}

async function readVideoChunkBase64ForWebSocket(clipUri: string, maxBytes: number) {
  const { base64, size } = await getLocalVideoChunkBytes(clipUri);
  if (size > maxBytes) {
    throw new Error(
      `Recorded clip is too large for live analysis (${Math.round(size / 1024)} KB). Retrying with the next compressed chunk.`
    );
  }

  return base64;
}

function normalizeDetectorVideoSummaryPayload(
  value: unknown,
  options: {
    fallbackFilename: string;
    fallbackSessionId: string | null;
    maxKeyFrames: number;
  }
): DetectorVideoSummary {
  const payload = asJsonRecord(value);
  if (!payload) {
    throw new Error('Detector returned an invalid analysis payload.');
  }

  const nestedSummary = asJsonRecord(payload.summary);
  const candidate = nestedSummary ?? payload;
  if (Array.isArray(candidate.frame_results) && !Array.isArray(candidate.key_frames)) {
    const summary = summarizeVideoAnalysisPayload(
      candidate as unknown as DetectorVideoAnalysisResponse,
      options.maxKeyFrames
    );

    return {
      ...summary,
      filename: summary.filename || options.fallbackFilename,
      session_id: summary.session_id || options.fallbackSessionId,
    };
  }

  const rawEvents = Array.isArray(candidate.events) ? candidate.events : [];
  const events = rawEvents
    .map((event, index) => asJsonRecord(event) ?? { start_frame_index: index })
    .map((event, index) => {
      const startTimestampSeconds = toNumber(event.start_timestamp_seconds);
      const endTimestampSeconds = Math.max(
        startTimestampSeconds,
        toNumber(event.end_timestamp_seconds)
      );

      return {
        duration_seconds:
          typeof event.duration_seconds === 'number' && Number.isFinite(event.duration_seconds)
            ? Math.max(0, event.duration_seconds)
            : Math.max(0, endTimestampSeconds - startTimestampSeconds),
        end_frame_index: Math.max(0, Math.trunc(toNumber(event.end_frame_index))),
        end_timestamp_seconds: endTimestampSeconds,
        frame_count: Math.max(1, Math.trunc(toNumber(event.frame_count || 1))),
        label: String(event.label ?? 'SUSPICIOUS').trim().toUpperCase(),
        max_score:
          event.max_score === null || event.max_score === undefined
            ? null
            : toNumber(event.max_score),
        reason: String(event.reason ?? '').trim() || 'Suspicious behavior detected.',
        severity: String(event.severity ?? '').trim() || null,
        signal_code: String(event.signal_code ?? '').trim() || null,
        start_frame_index: Math.max(0, Math.trunc(toNumber(event.start_frame_index || index))),
        start_timestamp_seconds: startTimestampSeconds,
      } satisfies DetectorVideoEvent;
    });

  const alerts = (Array.isArray(candidate.alerts) ? candidate.alerts : [])
    .map((alert) => asJsonRecord(alert))
    .filter((alert): alert is Record<string, unknown> => Boolean(alert))
    .map((alert) => {
      const startTimestampSeconds = toNumber(alert.start_timestamp_seconds);
      const endTimestampSeconds = Math.max(
        startTimestampSeconds,
        toNumber(alert.end_timestamp_seconds)
      );

      return {
        duration_seconds:
          typeof alert.duration_seconds === 'number' && Number.isFinite(alert.duration_seconds)
            ? Math.max(0, alert.duration_seconds)
            : Math.max(0, endTimestampSeconds - startTimestampSeconds),
        end_timestamp_seconds: endTimestampSeconds,
        label: String(alert.label ?? 'SUSPICIOUS').trim().toUpperCase(),
        reason: String(alert.reason ?? '').trim() || 'Suspicious behavior detected.',
        severity: String(alert.severity ?? '').trim() || null,
        signal_code: String(alert.signal_code ?? '').trim() || null,
        start_timestamp_seconds: startTimestampSeconds,
      } satisfies DetectorVideoAlert;
    });

  const keyFrames = (Array.isArray(candidate.key_frames) ? candidate.key_frames : [])
    .map((frame) => asJsonRecord(frame))
    .filter((frame): frame is Record<string, unknown> => Boolean(frame))
    .slice(0, Math.max(1, Math.trunc(options.maxKeyFrames)))
    .map((frame) => ({
      frame_index: Math.max(0, Math.trunc(toNumber(frame.frame_index))),
      label: String(frame.label ?? 'NORMAL').trim().toUpperCase(),
      observations: Array.isArray(frame.observations)
        ? frame.observations.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [],
      score:
        frame.score === null || frame.score === undefined ? null : toNumber(frame.score),
      timestamp_seconds: toNumber(frame.timestamp_seconds),
    }));

  const sessionId =
    String(candidate.session_id ?? payload.session_id ?? options.fallbackSessionId ?? '').trim() ||
    null;

  return {
    average_score: toNumber(candidate.average_score),
    alerts,
    detections: Math.max(0, Math.trunc(toNumber(candidate.detections))),
    duration_seconds: Math.max(0, toNumber(candidate.duration_seconds)),
    events,
    filename: String(candidate.filename ?? options.fallbackFilename),
    final_label: String(candidate.final_label ?? candidate.label ?? 'NORMAL')
      .trim()
      .toUpperCase(),
    fps: Math.max(0, toNumber(candidate.fps)),
    frames_processed: Math.max(0, Math.trunc(toNumber(candidate.frames_processed))),
    frames_sampled: Math.max(0, Math.trunc(toNumber(candidate.frames_sampled))),
    key_frames: keyFrames,
    max_score: Math.max(0, toNumber(candidate.max_score)),
    session_id: sessionId,
    suspicious_event_count: resolveSuspiciousEventCount(
      candidate.suspicious_event_count,
      events.length
    ),
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

function getWebSocketPayloadErrorMessage(payload: Record<string, unknown>) {
  const rawDetail = payload.detail ?? payload.error ?? payload.message;
  if (typeof rawDetail === 'string' && rawDetail.trim()) {
    return rawDetail.trim();
  }

  if (rawDetail && typeof rawDetail === 'object') {
    try {
      const serialized = JSON.stringify(rawDetail);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // Fall through to generic message.
    }
  }

  return 'Detector WebSocket returned an error.';
}

type ProctoringAnalysisSocketOptions = {
  maxInFlightChunks?: number;
  maxQueuedChunks?: number;
  onAnalysis?: (result: {
    kind: string;
    processingMs: number | null;
    sequence: number;
    summary: DetectorVideoSummary;
  }) => void;
  onChunkDropped?: (details: { reason: string; sequence: number }) => void;
  onConnectionStateChange?: (state: 'connecting' | 'ready' | 'reconnecting' | 'closed') => void;
  onError?: (message: string) => void;
  onSessionId?: (sessionId: string) => void;
  url?: string;
};

type AnalyzeVideoChunkParams = {
  clipUri: string;
  contentType?: string;
  filename?: string;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
};

class ProctoringAnalysisWebSocket {
  private connectPromise: Promise<void> | null = null;
  private inFlightChunks = new Map<number, InFlightWebSocketChunk>();
  private manuallyClosed = false;
  private maxChunkBytes = getConfiguredWebSocketMaxChunkBytes();
  private readonly maxInFlightChunks: number;
  private readonly maxQueuedChunks: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private queue: QueuedWebSocketChunk[] = [];
  private ready = false;
  private readyReject: ((error: Error) => void) | null = null;
  private readyResolve: (() => void) | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private sendLoopActive = false;
  private sequence = 0;
  private sessionId: string | null = null;
  private socket: WebSocket | null = null;
  private readonly url: string;

  constructor(private readonly options: ProctoringAnalysisSocketOptions = {}) {
    this.url = normalizeDetectorWebSocketUrl(options.url ?? '') || getDetectorWebSocketUrl();
    this.maxInFlightChunks = Math.max(1, Math.trunc(options.maxInFlightChunks ?? 3));
    this.maxQueuedChunks = Math.max(
      1,
      Math.trunc(options.maxQueuedChunks ?? WEBSOCKET_MAX_QUEUE_LENGTH)
    );
  }

  getCurrentSessionId() {
    return this.sessionId;
  }

  async connect() {
    if (this.ready && this.socket?.readyState === WS_OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.manuallyClosed = false;
    this.ready = false;
    this.options.onConnectionStateChange?.(this.socket ? 'reconnecting' : 'connecting');

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      this.readyResolve = resolve;
      this.readyReject = reject;

      this.readyTimeout = setTimeout(() => {
        this.failReady(new Error('Detector WebSocket did not send a ready message in time.'));
        this.closeSocketOnly();
      }, WEBSOCKET_CONNECT_TIMEOUT_MS);

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        const error = new Error('Detector WebSocket connection error.');
        this.options.onError?.(error.message);
        this.failReady(error);
        if (!this.manuallyClosed) {
          this.closeSocketOnly();
        }
      };

      socket.onclose = () => {
        this.handleSocketClose();
      };
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  sendVideoChunk(params: AnalyzeVideoChunkParams) {
    if (this.manuallyClosed) {
      this.options.onError?.('Detector WebSocket is closed.');
      return null;
    }

    const sequence = this.sequence + 1;
    this.sequence = sequence;
    const filename = params.filename?.trim() || `chunk-${sequence}.mp4`;
    const contentType = params.contentType?.trim() || 'video/mp4';

    while (this.queue.length >= this.maxQueuedChunks) {
      const droppedChunk = this.queue.shift();
      if (droppedChunk) {
        this.notifyChunkDropped(
          droppedChunk.sequence,
          'Detector send queue is full; dropped an older unsent chunk to keep live capture moving.'
        );
      }
    }

    this.queue.push({
      clipUri: params.clipUri,
      contentType,
      filename,
      maxFrames: Math.max(1, Math.trunc(params.maxFrames)),
      maxKeyFrames: Math.max(1, Math.trunc(params.maxKeyFrames)),
      sampleEveryNFrames: Math.max(1, Math.trunc(params.sampleEveryNFrames)),
      sequence,
    });

    void this.drainQueue();
    return sequence;
  }

  close() {
    this.manuallyClosed = true;
    this.stopPing();
    this.clearReadyTimeout();
    this.failReady(new Error('Detector WebSocket was closed.'));

    for (const chunk of this.queue) {
      this.notifyChunkDropped(chunk.sequence, 'Detector WebSocket was closed.');
    }
    this.queue = [];
    this.dropAllInFlightChunks('Detector WebSocket was closed.');

    if (this.socket?.readyState === WS_OPEN) {
      try {
        this.socket.send(JSON.stringify({ type: 'close' }));
      } catch {
        // Best effort close signal.
      }
    }

    this.closeSocketOnly();
    this.options.onConnectionStateChange?.('closed');
  }

  private clearReadyTimeout() {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
  }

  private closeSocketOnly() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) {
      return;
    }

    try {
      socket.close();
    } catch {
      // Ignore close errors.
    }
  }

  private clearInFlightChunk(sequence: number) {
    const chunk = this.inFlightChunks.get(sequence);
    if (!chunk) {
      return null;
    }

    clearTimeout(chunk.timeout);
    this.inFlightChunks.delete(sequence);
    return chunk;
  }

  private failReady(error: Error) {
    this.clearReadyTimeout();
    if (this.readyReject) {
      this.readyReject(error);
      this.readyReject = null;
      this.readyResolve = null;
    }
  }

  private finishReady() {
    this.ready = true;
    this.clearReadyTimeout();
    this.startPing();
    this.options.onConnectionStateChange?.('ready');
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
      this.readyReject = null;
    }
  }

  private dropAllInFlightChunks(reason: string) {
    const sequences = [...this.inFlightChunks.keys()];
    for (const sequence of sequences) {
      this.dropInFlightChunk(sequence, reason);
    }
  }

  private dropInFlightChunk(sequence: number, reason: string) {
    const chunk = this.clearInFlightChunk(sequence);
    if (!chunk) {
      return;
    }

    this.notifyChunkDropped(sequence, reason);
  }

  private handleSocketClose() {
    this.stopPing();
    this.ready = false;
    this.connectPromise = null;
    this.socket = null;
    this.failReady(new Error('Detector WebSocket closed before it became ready.'));

    if (this.manuallyClosed) {
      this.options.onConnectionStateChange?.('closed');
      return;
    }

    this.options.onConnectionStateChange?.('reconnecting');
    this.dropAllInFlightChunks('Detector WebSocket disconnected before analysis returned.');
    if (this.queue.length > 0) {
      setTimeout(() => {
        void this.drainQueue();
      }, 800);
    }
  }

  private handleMessage(rawData: unknown) {
    let payload: Record<string, unknown> | null = null;
    try {
      const parsed =
        typeof rawData === 'string' ? JSON.parse(rawData) : JSON.parse(String(rawData ?? '{}'));
      payload = asJsonRecord(parsed);
    } catch {
      this.options.onError?.('Detector WebSocket sent a malformed message.');
      return;
    }

    if (!payload) {
      return;
    }

    const type = String(payload.type ?? '').trim().toLowerCase();
    if (type === 'ready') {
      this.finishReady();
      void this.drainQueue();
      return;
    }

    if (type === 'session') {
      this.storeSessionId(payload.session_id);
      return;
    }

    if (type === 'pong') {
      return;
    }

    if (type === 'error') {
      const error = new Error(`Detector WebSocket error: ${getWebSocketPayloadErrorMessage(payload)}`);
      this.options.onError?.(error.message);
      const sequence = Math.trunc(toNumber(payload.sequence));
      if (sequence > 0) {
        this.dropInFlightChunk(sequence, error.message);
        void this.drainQueue();
      }
      return;
    }

    if (type !== 'analysis') {
      return;
    }

    const sequence = Math.trunc(toNumber(payload.sequence));
    const inFlightChunk = this.clearInFlightChunk(sequence);
    if (!inFlightChunk) {
      return;
    }

    this.storeSessionId(payload.session_id);

    try {
      const summary = normalizeDetectorVideoSummaryPayload(payload.result, {
        fallbackFilename: inFlightChunk.filename,
        fallbackSessionId: this.sessionId,
        maxKeyFrames: inFlightChunk.maxKeyFrames,
      });
      const rawProcessingMs = Number(payload.processing_ms);
      this.options.onAnalysis?.({
        kind: String(payload.kind ?? 'video_chunk').trim() || 'video_chunk',
        processingMs: Number.isFinite(rawProcessingMs) ? Math.max(0, Math.trunc(rawProcessingMs)) : null,
        sequence,
        summary,
      });
    } catch (error) {
      const message = toErrorMessage(
        error,
        'Detector analysis response was invalid.'
      );
      this.options.onError?.(message);
      this.notifyChunkDropped(sequence, message);
    }

    void this.drainQueue();
  }

  private notifyChunkDropped(sequence: number, reason: string) {
    this.options.onChunkDropped?.({ reason, sequence });
  }

  private async drainQueue() {
    if (
      this.sendLoopActive ||
      this.queue.length === 0 ||
      this.inFlightChunks.size >= this.maxInFlightChunks ||
      this.manuallyClosed
    ) {
      return;
    }

    this.sendLoopActive = true;
    try {
      while (
        this.queue.length > 0 &&
        this.inFlightChunks.size < this.maxInFlightChunks &&
        !this.manuallyClosed
      ) {
        const nextChunk = this.queue.shift();
        if (!nextChunk) {
          break;
        }

        try {
          await this.connect();
          const socket = this.socket;
          if (!this.ready || !socket || socket.readyState !== WS_OPEN) {
            throw new Error('Detector WebSocket is not open.');
          }

          const videoBase64 = await readVideoChunkBase64ForWebSocket(
            nextChunk.clipUri,
            this.maxChunkBytes
          );
          if (this.manuallyClosed) {
            this.notifyChunkDropped(nextChunk.sequence, 'Detector WebSocket was closed.');
            break;
          }

          const currentSocket = this.socket;
          if (!this.ready || !currentSocket || currentSocket.readyState !== WS_OPEN) {
            this.notifyChunkDropped(
              nextChunk.sequence,
              'Detector WebSocket disconnected before this chunk could be sent.'
            );
            break;
          }

          const timeout = setTimeout(() => {
            this.dropInFlightChunk(
              nextChunk.sequence,
              'Detector WebSocket analysis timed out for this chunk.'
            );
            void this.drainQueue();
          }, WEBSOCKET_ANALYSIS_TIMEOUT_MS);

          this.inFlightChunks.set(nextChunk.sequence, {
            filename: nextChunk.filename,
            maxKeyFrames: nextChunk.maxKeyFrames,
            sentAtMs: Date.now(),
            timeout,
          });

          try {
            currentSocket.send(
              JSON.stringify({
                content_type: nextChunk.contentType,
                filename: nextChunk.filename,
                include_frame_results: false,
                include_landmarks: false,
                max_frames: nextChunk.maxFrames,
                response_mode: 'summary',
                sample_every_n_frames: nextChunk.sampleEveryNFrames,
                sequence: nextChunk.sequence,
                type: 'video_chunk',
                video_base64: videoBase64,
              })
            );
          } catch (sendError) {
            this.clearInFlightChunk(nextChunk.sequence);
            throw sendError instanceof Error
              ? sendError
              : new Error('Unable to send video chunk over WebSocket.');
          }
        } catch (error) {
          const message = toErrorMessage(error, 'Unable to send video chunk over WebSocket.');
          this.notifyChunkDropped(nextChunk.sequence, message);
          this.options.onError?.(message);

          if (!this.ready || this.socket?.readyState !== WS_OPEN) {
            setTimeout(() => {
              void this.drainQueue();
            }, 800);
            break;
          }
        }
      }
    } finally {
      this.sendLoopActive = false;
      if (
        this.queue.length > 0 &&
        this.inFlightChunks.size < this.maxInFlightChunks &&
        !this.manuallyClosed
      ) {
        setTimeout(() => {
          void this.drainQueue();
        }, 0);
      }
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState !== WS_OPEN) {
        return;
      }

      try {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      } catch {
        // The close handler performs reconnection for future chunks.
      }
    }, WEBSOCKET_PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private storeSessionId(value: unknown) {
    const nextSessionId = String(value ?? '').trim();
    if (!nextSessionId || nextSessionId === this.sessionId) {
      return;
    }

    this.sessionId = nextSessionId;
    this.options.onSessionId?.(nextSessionId);
  }
}

export function createProctoringAnalysisSocket(options?: ProctoringAnalysisSocketOptions) {
  return new ProctoringAnalysisWebSocket(options);
}

function buildSessionDeviceInfo(profile: ProfileRow) {
  return {
    appRole: profile.role,
    institutionalId: profile.institutional_id,
    platform: Platform.OS,
  };
}

export async function ensureActiveProctoringSession({
  examId,
  monitoringMode,
}: {
  examId: string;
  monitoringMode: MonitoringMode;
}): Promise<ProctoringSessionHandle> {
  const normalizedExamId = examId.trim();
  if (!normalizedExamId) {
    throw new Error('No exam session selected for proctoring.');
  }

  const profile = await getCurrentStudentProfile();

  const [{ data: registration, error: registrationError }, { data: currentSession, error: sessionError }] =
    await Promise.all([
      supabase
        .from('exam_registrations')
        .select('id')
        .eq('exam_id', normalizedExamId)
        .eq('student_id', profile.id)
        .maybeSingle<RegistrationRow>(),
      supabase
        .from('analysis_sessions')
        .select('id, student_id, backend_session_id, started_at')
        .eq('exam_id', normalizedExamId)
        .eq('student_id', profile.id)
        .in('status', ['pending', 'active', 'paused'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle<AnalysisSessionRow>(),
    ]);

  if (registrationError || !registration) {
    throw new Error(`Unable to locate your exam registration: ${registrationError?.message ?? 'Not found.'}`);
  }

  if (sessionError) {
    throw new Error(`Unable to load current proctoring session: ${sessionError.message}`);
  }

  if (currentSession) {
    const { error: activateError } = await supabase
      .from('analysis_sessions')
      .update({
        analysis_config: {
          detectorBaseUrl: getDetectorBaseUrl(),
          detectorWebSocketUrl: getDetectorWebSocketUrl(),
          monitoringMode,
        },
        backend_session_id: null,
        status: 'active',
      })
      .eq('id', currentSession.id);

    if (activateError) {
      throw new Error(`Unable to activate proctoring session: ${activateError.message}`);
    }

    return {
      aiSessionId: null,
      analysisSessionId: currentSession.id,
      examId: normalizedExamId,
      startedAtIso: currentSession.started_at,
      studentId: currentSession.student_id,
    };
  }

  const { data: insertedSession, error: insertError } = await supabase
    .from('analysis_sessions')
    .insert({
      analysis_config: {
        detectorBaseUrl: getDetectorBaseUrl(),
        detectorWebSocketUrl: getDetectorWebSocketUrl(),
        monitoringMode,
      },
      backend_session_id: null,
      device_info: buildSessionDeviceInfo(profile),
      exam_id: normalizedExamId,
      registration_id: registration.id,
      source: 'mobile',
      status: 'active',
      student_id: profile.id,
    })
    .select('id, student_id, backend_session_id, started_at')
    .single<AnalysisSessionRow>();

  if (insertError || !insertedSession) {
    throw new Error(`Unable to create proctoring session: ${insertError?.message ?? 'Unknown error.'}`);
  }

  return {
    aiSessionId: insertedSession.backend_session_id,
    analysisSessionId: insertedSession.id,
    examId: normalizedExamId,
    startedAtIso: insertedSession.started_at,
    studentId: insertedSession.student_id,
  };
}

export async function syncAnalysisSessionMetrics({
  analysisSessionId,
  backendSessionId,
  metrics,
  status,
}: {
  analysisSessionId: string;
  backendSessionId?: string | null;
  metrics: ProctoringAggregateMetrics;
  status: SessionStatus;
}) {
  const updatePayload: Record<string, unknown> = {
    average_score: metrics.averageScore,
    detections: metrics.detections,
    final_label: metrics.finalLabel,
    frames_processed: metrics.framesProcessed,
    frames_sampled: metrics.framesSampled,
    latest_observation: metrics.latestObservation || null,
    max_score: metrics.maxScore,
    status,
    suspicious_event_count: metrics.suspiciousEventCount,
  };
  const normalizedBackendSessionId = String(backendSessionId ?? '').trim();
  if (normalizedBackendSessionId) {
    updatePayload.backend_session_id = normalizedBackendSessionId;
  }

  const { error } = await supabase
    .from('analysis_sessions')
    .update(updatePayload)
    .eq('id', analysisSessionId);

  if (error) {
    throw new Error(`Unable to sync live analysis metrics: ${error.message}`);
  }
}

export async function endProctoringSession({
  analysisSessionId,
  finalMetrics,
  finalStatus,
}: {
  analysisSessionId: string;
  finalMetrics: ProctoringAggregateMetrics;
  finalStatus: SessionStatus;
}) {
  const terminalStatus =
    finalStatus === 'submitted' || finalStatus === 'completed' || finalStatus === 'terminated'
      ? finalStatus
      : 'paused';

  const endingTimeIso =
    terminalStatus === 'submitted' || terminalStatus === 'completed' || terminalStatus === 'terminated'
      ? new Date().toISOString()
      : null;

  const { error } = await supabase
    .from('analysis_sessions')
    .update({
      average_score: finalMetrics.averageScore,
      detections: finalMetrics.detections,
      ended_at: endingTimeIso,
      final_label: finalMetrics.finalLabel,
      frames_processed: finalMetrics.framesProcessed,
      frames_sampled: finalMetrics.framesSampled,
      latest_observation: finalMetrics.latestObservation || null,
      max_score: finalMetrics.maxScore,
      status: terminalStatus,
      suspicious_event_count: finalMetrics.suspiciousEventCount,
    })
    .eq('id', analysisSessionId);

  if (error) {
    throw new Error(`Unable to finalize proctoring session: ${error.message}`);
  }
}

async function insertSuspiciousEventWithEvidence(
  payload: InsertSuspiciousEventInput
): Promise<string> {
  const { data, error } = await supabase
    .from('suspicious_events')
    .insert({
      analysis_session_id: payload.analysisSessionId,
      end_frame_index: payload.endFrameIndex,
      end_timestamp_seconds: payload.endTimestampSeconds,
      evidence: payload.evidence,
      exam_id: payload.examId,
      frame_count: payload.frameCount,
      label: payload.label,
      max_score: payload.maxScore,
      reason: payload.reason,
      risk_level: payload.riskLevel,
      source: payload.source ?? 'ai-video',
      start_frame_index: payload.startFrameIndex,
      start_timestamp_seconds: payload.startTimestampSeconds,
      student_id: payload.studentId,
    })
    .select('id')
    .single<InsertedSuspiciousEventRow>();

  if (!error && data?.id) {
    return data.id;
  }

  const fallback = await supabase
    .from('suspicious_events')
    .insert({
      analysis_session_id: payload.analysisSessionId,
      end_frame_index: payload.endFrameIndex,
      end_timestamp_seconds: payload.endTimestampSeconds,
      exam_id: payload.examId,
      frame_count: payload.frameCount,
      label: payload.label,
      max_score: payload.maxScore,
      reason: payload.reason,
      risk_level: payload.riskLevel,
      source: payload.source ?? 'ai-video',
      start_frame_index: payload.startFrameIndex,
      start_timestamp_seconds: payload.startTimestampSeconds,
      student_id: payload.studentId,
    })
    .select('id')
    .single<InsertedSuspiciousEventRow>();

  if (fallback.error || !fallback.data?.id) {
    throw new Error(`Unable to store suspicious event: ${fallback.error?.message ?? error?.message ?? 'Unknown error.'}`);
  }

  return fallback.data.id;
}

export async function insertSuspiciousEvent(payload: InsertSuspiciousEventInput) {
  return insertSuspiciousEventWithEvidence(payload);
}

function isMissingSuspiciousEvidenceColumnError(error: { code?: string | null; message?: string | null }) {
  const code = String(error.code ?? '').trim().toUpperCase();
  const message = String(error.message ?? '').toLowerCase();

  if (code === 'PGRST204') {
    return true;
  }

  return (
    /column .*evidence/.test(message) ||
    /could not find the ['"]evidence['"] column/.test(message) ||
    (message.includes('schema cache') && message.includes('evidence'))
  );
}

export async function updateSuspiciousEventEvidence(
  suspiciousEventId: string,
  evidence: SuspiciousEventEvidence
) {
  const { error } = await supabase
    .from('suspicious_events')
    .update({
      evidence,
    })
    .eq('id', suspiciousEventId);

  if (error && !isMissingSuspiciousEvidenceColumnError(error)) {
    throw new Error(`Unable to update suspicious evidence bundle: ${error.message}`);
  }
}

export async function uploadSuspiciousClipSegment({
  clipUri,
  path,
}: {
  clipUri: string;
  path: string;
}) {
  await ensureAuthenticatedStorageUploadUser();

  const extension = inferVideoExtensionFromUri(clipUri);
  const mimeType = inferVideoMimeTypeFromExtension(extension);
  const clipBytes = await readLocalFileAsArrayBuffer(clipUri);

  let uploadResult: Awaited<ReturnType<ReturnType<typeof supabase.storage.from>['upload']>>;
  try {
    uploadResult = await supabase.storage.from(SUSPICIOUS_CLIP_BUCKET).upload(path, clipBytes, {
      contentType: mimeType,
      upsert: false,
    });
  } catch (networkError) {
    throw new Error(
      `Unable to upload suspicious clip segment: ${
        networkError instanceof Error ? networkError.message : 'Network request failed.'
      }`
    );
  }

  const { error } = uploadResult;

  if (error) {
    if (/row-level security|violates row-level security|permission denied/i.test(error.message)) {
      throw new Error(
        'Unable to upload suspicious clip segment because Supabase Storage rejected the upload. Apply the latest suspiciousVideos storage policy migration and confirm the signed-in exam session is still authenticated.'
      );
    }

    throw new Error(`Unable to upload suspicious clip segment: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(SUSPICIOUS_CLIP_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: publicUrlData.publicUrl ?? null,
  };
}

export function buildSuspiciousEvidenceTemplate({
  detectorSessionId,
  durationSeconds,
  eventEndOffsetSeconds,
  eventDurationSeconds,
  eventStartOffsetSeconds,
  severity,
  signalCode,
  requestedLeadSeconds,
  requestedTrailSeconds,
  wasTruncated,
  windowEndIso,
  windowStartIso,
}: {
  detectorSessionId: string | null;
  durationSeconds: number;
  eventEndOffsetSeconds: number;
  eventDurationSeconds: number;
  eventStartOffsetSeconds: number;
  severity?: string | null;
  signalCode?: string | null;
  requestedLeadSeconds: number;
  requestedTrailSeconds: number;
  wasTruncated: boolean;
  windowEndIso: string;
  windowStartIso: string;
}): SuspiciousEventEvidence {
  return {
    ai: {
      detectorSessionId,
      durationSeconds: Number(durationSeconds.toFixed(2)),
      eventEndOffsetSeconds: Number(eventEndOffsetSeconds.toFixed(2)),
      eventDurationSeconds: Number(eventDurationSeconds.toFixed(2)),
      eventStartOffsetSeconds: Number(eventStartOffsetSeconds.toFixed(2)),
      severity: String(severity ?? '').trim() || null,
      signalCode: String(signalCode ?? '').trim() || null,
    },
    clipBundleVersion: 1,
    requestedLeadSeconds,
    requestedTrailSeconds,
    segments: [],
    wasTruncated,
    windowEndIso,
    windowStartIso,
  };
}

export function parseSuspiciousEvidence(value: unknown): SuspiciousEventEvidence | null {
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }

  const rawSegments = Array.isArray(record.segments) ? record.segments : [];
  const segments: SuspiciousEvidenceSegment[] = rawSegments
    .map((item) => asJsonRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((segment) => ({
      durationSeconds: Math.max(0, toNumber(segment.durationSeconds)),
      endedAtIso: String(segment.endedAtIso ?? ''),
      path: String(segment.path ?? ''),
      publicUrl: String(segment.publicUrl ?? '').trim() || null,
      startedAtIso: String(segment.startedAtIso ?? ''),
    }))
    .filter((segment) => Boolean(segment.path));

  const ai = asJsonRecord(record.ai) ?? {};

  return {
    ai: {
      detectorSessionId: String(ai.detectorSessionId ?? '') || null,
      durationSeconds: Math.max(0, toNumber(ai.durationSeconds)),
      eventEndOffsetSeconds: Math.max(0, toNumber(ai.eventEndOffsetSeconds)),
      eventDurationSeconds:
        typeof ai.eventDurationSeconds === 'number' && Number.isFinite(ai.eventDurationSeconds)
          ? Math.max(0, ai.eventDurationSeconds)
          : Math.max(
              0,
              toNumber(ai.eventEndOffsetSeconds) - toNumber(ai.eventStartOffsetSeconds)
            ),
      eventStartOffsetSeconds: Math.max(0, toNumber(ai.eventStartOffsetSeconds)),
      severity: String(ai.severity ?? '').trim() || null,
      signalCode: String(ai.signalCode ?? '').trim() || null,
    },
    clipBundleVersion: Math.max(1, Math.trunc(toNumber(record.clipBundleVersion || 1))),
    requestedLeadSeconds: Math.max(0, toNumber(record.requestedLeadSeconds)),
    requestedTrailSeconds: Math.max(0, toNumber(record.requestedTrailSeconds)),
    segments,
    wasTruncated: Boolean(record.wasTruncated),
    windowEndIso: String(record.windowEndIso ?? ''),
    windowStartIso: String(record.windowStartIso ?? ''),
  };
}

export function detectorLabelToAnalysisLabel(value: string | null | undefined): AnalysisLabel {
  return toAnalysisLabel(value);
}

export function detectorScoreToRiskLevel(score: number | null | undefined): RiskLevel {
  return toRiskLevel(score);
}
