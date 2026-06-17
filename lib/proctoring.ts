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
  end_frame_index: number;
  end_timestamp_seconds: number;
  frame_count: number;
  label: string;
  max_score: number | null;
  reason: string;
  start_frame_index: number;
  start_timestamp_seconds: number;
};

export type DetectorVideoSummary = {
  average_score: number;
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
    eventStartOffsetSeconds: number;
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
  startFrameIndex: number;
  startTimestampSeconds: number;
  studentId: string;
};

export const SUSPICIOUS_CLIP_BUCKET = 'suspiciousVideos';

const ANALYSIS_LABEL_WEIGHT: Record<AnalysisLabel, number> = {
  CAUTION: 2,
  NORMAL: 1,
  NO_FACE: 0,
  SUSPICIOUS: 3,
};
let detectorSummaryEndpointUnsupported = false;
let resolvedDetectorBaseUrl = '';

function normalizeBaseUrl(urlInput: string) {
  return urlInput.trim().replace(/\/+$/, '');
}

function parseExpoHostForDetector() {
  const expoHostUri = String(Constants.expoConfig?.hostUri ?? '').trim();
  if (expoHostUri) {
    const host = expoHostUri.split(':')[0]?.trim();
    if (host) {
      return host;
    }
  }

  const legacyDebuggerHost = String(
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ?? ''
  ).trim();
  if (legacyDebuggerHost) {
    const host = legacyDebuggerHost.split(':')[0]?.trim();
    if (host) {
      return host;
    }
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

async function readLocalFileAsArrayBuffer(fileUri: string) {
  const info = await FileSystem.getInfoAsync(fileUri);
  const fileSize = typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || info.isDirectory || fileSize <= 0) {
    throw new Error('Suspicious clip segment file is empty or missing.');
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('Suspicious clip segment file could not be read for upload.');
  }

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
  }

  const fallback = await fetch(`data:application/octet-stream;base64,${base64}`);
  const fallbackBuffer = await fallback.arrayBuffer();
  if (fallbackBuffer.byteLength <= 0) {
    throw new Error('Suspicious clip segment upload payload was empty.');
  }

  return fallbackBuffer;
}

function rewriteLoopbackConfiguredBaseUrl(configuredUrl: string) {
  const normalized = normalizeBaseUrl(configuredUrl);
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
    const normalized = normalizeBaseUrl(value);
    if (!normalized) {
      return;
    }

    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(resolvedDetectorBaseUrl);
  pushCandidate(getConfiguredDetectorBaseUrl());

  const expoHost = parseExpoHostForDetector();
  if (isLikelyLocalNetworkHost(expoHost)) {
    pushCandidate(`http://${expoHost}:8000`);
  }

  if (Platform.OS === 'android') {
    pushCandidate('http://10.0.2.2:8000');
  }

  pushCandidate('http://127.0.0.1:8000');
  pushCandidate('http://localhost:8000');

  return candidates;
}

function setResolvedDetectorBaseUrl(baseUrl: string) {
  resolvedDetectorBaseUrl = normalizeBaseUrl(baseUrl);
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
    `Unable to reach detector service. Tried: ${attempted}. If this is a physical phone, set EXPO_PUBLIC_CHEATING_DETECTOR_URL to http://<your-laptop-lan-ip>:8000, run detector with: uvicorn cheating_detector.api.app:app --host 0.0.0.0 --port 8000, make sure Windows Firewall allows inbound TCP 8000, and restart Expo.`
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
  return getDetectorBaseUrlCandidates()[0] ?? deriveDetectorFallbackBaseUrl();
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
    current.suspiciousEventCount + Math.max(0, toNumber(summary.suspicious_event_count));
  const nextMaxScore = Math.max(current.maxScore, Math.max(0, toNumber(summary.max_score)));

  const currentWeighted = current.averageScore * current.framesSampled;
  const summaryWeighted = toNumber(summary.average_score) * Math.max(0, toNumber(summary.frames_sampled));
  const nextAverage =
    nextFramesSampled > 0 ? Number(((currentWeighted + summaryWeighted) / nextFramesSampled).toFixed(2)) : 0;

  const summaryLabel = toAnalysisLabel(summary.final_label);
  const nextFinalLabel =
    ANALYSIS_LABEL_WEIGHT[summaryLabel] >= ANALYSIS_LABEL_WEIGHT[current.finalLabel]
      ? summaryLabel
      : current.finalLabel;

  const nextObservation =
    summary.key_frames
      ?.flatMap((keyFrame) => keyFrame.observations ?? [])
      .find((observation) => observation && observation.trim().length > 0)
      ?.trim() ??
    summary.events?.[0]?.reason?.trim() ??
    current.latestObservation;

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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error('Unable to verify your sign-in session for suspicious clip upload.');
  }

  const expiresAtSeconds = Number(sessionData.session?.expires_at ?? 0);
  const refreshToken = String(sessionData.session?.refresh_token ?? '').trim();
  const expiresSoon =
    expiresAtSeconds > 0 && expiresAtSeconds * 1000 <= Date.now() + 60_000;

  if (refreshToken && expiresSoon) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error(
        'Your sign-in session expired before the suspicious clip upload. Sign in again and restart the exam session.'
      );
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

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
  nativeUploadMode?: NativeVideoUploadMode;
  includeSamplingFields?: boolean;
  includeSessionIdField?: boolean;
  maxFrames: number;
  maxKeyFrames: number;
  sampleEveryNFrames: number;
  includeLandmarksField: boolean;
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

  return {
    average_score: analysisPayload.average_score,
    detections: analysisPayload.detections,
    duration_seconds: analysisPayload.duration_seconds,
    events: analysisPayload.events ?? [],
    filename: analysisPayload.filename,
    final_label: analysisPayload.final_label,
    fps: analysisPayload.fps,
    frames_processed: analysisPayload.frames_processed,
    frames_sampled: analysisPayload.frames_sampled,
    key_frames: keyFrames,
    max_score: analysisPayload.max_score,
    session_id: analysisPayload.session_id,
    suspicious_event_count: analysisPayload.suspicious_event_count,
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
      const payload = (await summaryResponse.json()) as DetectorVideoSummary;
      return payload;
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
    const detail = await getDetectorErrorDetail(videoResponse);
    throw new Error(detail || `Detector rejected the video analysis request (${videoResponse.status}).`);
  }

  const payload = (await videoResponse.json()) as DetectorVideoAnalysisResponse;
  return summarizeVideoAnalysisPayload(payload, params.maxKeyFrames);
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
    let detectorSessionId = String(currentSession.backend_session_id ?? '').trim() || null;
    if (!detectorSessionId) {
      detectorSessionId = await createDetectorSession();
    }

    const { error: activateError } = await supabase
      .from('analysis_sessions')
      .update({
        analysis_config: {
          detectorBaseUrl: getDetectorBaseUrl(),
          monitoringMode,
        },
        backend_session_id: detectorSessionId,
        status: 'active',
      })
      .eq('id', currentSession.id);

    if (activateError) {
      throw new Error(`Unable to activate proctoring session: ${activateError.message}`);
    }

    return {
      aiSessionId: detectorSessionId,
      analysisSessionId: currentSession.id,
      examId: normalizedExamId,
      startedAtIso: currentSession.started_at,
      studentId: currentSession.student_id,
    };
  }

  const detectorSessionId = await createDetectorSession();

  const { data: insertedSession, error: insertError } = await supabase
    .from('analysis_sessions')
    .insert({
      analysis_config: {
        detectorBaseUrl: getDetectorBaseUrl(),
        monitoringMode,
      },
      backend_session_id: detectorSessionId,
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
      source: 'ai-video',
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
      source: 'ai-video',
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

  const { error } = await supabase.storage.from(SUSPICIOUS_CLIP_BUCKET).upload(path, clipBytes, {
    contentType: mimeType,
    upsert: false,
  });

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
  eventStartOffsetSeconds,
  requestedLeadSeconds,
  requestedTrailSeconds,
  wasTruncated,
  windowEndIso,
  windowStartIso,
}: {
  detectorSessionId: string | null;
  durationSeconds: number;
  eventEndOffsetSeconds: number;
  eventStartOffsetSeconds: number;
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
      eventStartOffsetSeconds: Number(eventStartOffsetSeconds.toFixed(2)),
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
      eventStartOffsetSeconds: Math.max(0, toNumber(ai.eventStartOffsetSeconds)),
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
