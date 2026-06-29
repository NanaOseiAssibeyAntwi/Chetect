import { supabase } from '@/lib/supabase';
import { syncExamLifecycleStatuses } from '@/lib/exam-lifecycle';
import { parseSuspiciousEvidence, SUSPICIOUS_CLIP_BUCKET } from '@/lib/proctoring';

type AppRole = 'student' | 'invigilator' | 'admin';
type ExamStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';
type MonitoringMode = 'standard' | 'strict' | 'minimal';
type AnalysisLabel = 'NO_FACE' | 'NORMAL' | 'CAUTION' | 'SUSPICIOUS';
type SessionStatus = 'pending' | 'active' | 'paused' | 'submitted' | 'completed' | 'terminated';

type ProfileRow = {
  department_name?: string | null;
  full_name: string;
  id: string;
  institutional_id: string | null;
  role: AppRole;
};

type ExamInvigilatorRow = {
  exam_id: string;
};

type ExamIdRow = {
  id: string;
};

type CourseRow = {
  code?: string | null;
  id: string;
  title: string;
};

type StudentProfileRow = {
  email?: string | null;
  id: string;
  full_name?: string | null;
  institutional_id: string | null;
  metadata?: Record<string, unknown> | null;
};

type ExamRow = {
  course_id: string;
  id: string;
  monitoring_mode: MonitoringMode;
  scheduled_end: string;
  scheduled_start: string;
  status: ExamStatus;
  title: string;
};

type ExamTimingRow = {
  id: string;
  scheduled_end: string;
  scheduled_start: string;
  status: ExamStatus;
};

type ExamRegistrationRow = {
  registration_status: string;
  student_id: string;
};

type ExamQuestionInsertRow = {
  id: string;
};

type ExamQuestionOptionInsertRow = {
  id: string;
  option_order: number;
};

type AnalysisSessionRow = {
  final_label: AnalysisLabel;
  latest_observation: string | null;
  max_score: number | null;
  started_at: string;
  status: SessionStatus;
  student_id: string;
  suspicious_event_count: number | null;
};

type SuspiciousEventRow = {
  created_at: string;
  end_timestamp_seconds: number;
  evidence?: Record<string, unknown> | null;
  id: string;
  label: AnalysisLabel;
  max_score: number | null;
  reason: string;
  risk_level: string;
  start_timestamp_seconds: number;
  student_id: string;
};

type AnalysisScoreRow = {
  max_score: number | null;
};

type NotificationRow = {
  id: string;
};

type InvigilatorLiveOverviewRow = {
  course_code: string;
  course_title: string;
  exam_id: string;
  exam_title: string;
  flagged_sessions: number | null;
  highest_score: number | null;
  live_sessions: number | null;
  monitoring_mode: MonitoringMode;
  registered_students: number | null;
  scheduled_start: string;
  status: ExamStatus;
};

type InvigilatorProfileOverviewRow = {
  exam_id: string;
  flagged_sessions: number | null;
  status: ExamStatus;
};

export type SessionRiskLevel = 'low' | 'medium' | 'high';

export type InvigilatorLiveSession = {
  code: string;
  examId: string;
  flaggedSessions: number;
  highestScore: number;
  liveSessions: number;
  monitoringMode: MonitoringMode;
  registeredStudents: number;
  riskLevel: SessionRiskLevel;
  scheduledStart: string;
  status: ExamStatus;
  title: string;
};

export type InvigilatorDashboardData = {
  sessions: InvigilatorLiveSession[];
  stats: {
    active: number;
    done: number;
    flagged: number;
    online: number;
    totalSessions: number;
  };
  staffInstitutionalId: string | null;
  staffName: string;
};

export type InvigilatorProfileData = {
  departmentName: string | null;
  role: AppRole;
  staffId: string | null;
  staffName: string;
  stats: {
    averageTrust: number;
    flaggedSessions: number;
    level: string;
    sessions: number;
  };
  unreadNotifications: number;
};

export type CreateExamQuestionInput = {
  correctOptionIndex: number;
  options: string[];
  prompt: string;
};

export type CreateExamSessionInput = {
  courseCode: string;
  courseTitle: string;
  durationHours: number;
  examDate: string;
  maxStudents: number;
  monitoringMode: MonitoringMode;
  questions?: CreateExamQuestionInput[];
  startTime: string;
  studentInstitutionalIds?: string[];
};

export type CreateExamSessionResult = {
  examId: string;
  missingStudentIds: string[];
  registeredCount: number;
};

export type MonitorRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MonitorIndicatorStatus = 'ok' | 'alert';
export type InvigilatorSuspiciousClipRole =
  | 'event'
  | 'context-before'
  | 'context-after'
  | 'context';

export type InvigilatorSuspiciousClipSegment = {
  durationSeconds: number;
  endedAtIso: string;
  path: string;
  role: InvigilatorSuspiciousClipRole;
  videoUrl: string | null;
  startedAtIso: string;
};

export type InvigilatorSuspiciousEvent = {
  createdAt: string;
  endTimestampSeconds: number;
  id: string;
  label: AnalysisLabel;
  maxScore: number;
  reason: string;
  riskLevel: MonitorRiskLevel;
  requestedLeadSeconds: number;
  requestedTrailSeconds: number;
  segments: InvigilatorSuspiciousClipSegment[];
  startTimestampSeconds: number;
  studentId: string;
  studentInstitutionalId: string;
  studentName: string;
  wasTruncated: boolean;
  windowEndIso: string | null;
  windowStartIso: string | null;
};

export type InvigilatorMonitorStudent = {
  indicators: {
    audio: MonitorIndicatorStatus;
    face: MonitorIndicatorStatus;
    gaze: MonitorIndicatorStatus;
    multiFace: MonitorIndicatorStatus;
  };
  initials: string;
  institutionalId: string;
  isActive: boolean;
  isCritical: boolean;
  isDone: boolean;
  isFlagged: boolean;
  name: string;
  riskLevel: MonitorRiskLevel;
  score: number;
  status: string;
  studentId: string;
};

export type InvigilatorMonitorData = {
  courseCode: string;
  examId: string;
  examStatus: ExamStatus;
  monitorMode: MonitoringMode;
  stats: {
    active: number;
    critical: number;
    done: number;
    flagged: number;
    total: number;
  };
  students: InvigilatorMonitorStudent[];
  title: string;
};

function normalizeInstitutionalId(value: string) {
  return value.trim().toLowerCase();
}

function profileLookupTokens(profile: StudentProfileRow) {
  const tokens = new Set<string>();
  const institutionalId = normalizeInstitutionalId(String(profile.institutional_id ?? ''));
  const email = normalizeInstitutionalId(String(profile.email ?? ''));
  const metadataUsername = normalizeInstitutionalId(String(profile.metadata?.username ?? ''));

  if (institutionalId) {
    tokens.add(institutionalId);
  }

  if (email) {
    tokens.add(email);

    const emailPrefix = email.split('@')[0];
    if (emailPrefix) {
      tokens.add(emailPrefix);
    }
  }

  if (metadataUsername) {
    tokens.add(metadataUsername);
  }

  return tokens;
}

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toTimestampMs(value: string | null | undefined) {
  const timestamp = new Date(String(value ?? '')).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function ensureInvigilatorRole(role: AppRole) {
  if (role !== 'invigilator' && role !== 'admin') {
    throw new Error('This account is not authorized for invigilator actions.');
  }
}

function parseScheduledStart(examDate: string, startTime: string) {
  const dateInput = examDate.trim();
  const timeInput = startTime.trim();

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!dateMatch) {
    throw new Error('Enter date using YYYY-MM-DD.');
  }

  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeInput);
  if (!timeMatch) {
    throw new Error('Enter start time using HH:MM (24-hour).');
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const scheduledStart = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(scheduledStart.getTime()) ||
    scheduledStart.getFullYear() !== year ||
    scheduledStart.getMonth() !== month - 1 ||
    scheduledStart.getDate() !== day
  ) {
    throw new Error('Enter a valid exam date and start time.');
  }

  return scheduledStart.toISOString();
}

function normalizeCreateExamQuestions(rawQuestions: CreateExamSessionInput['questions']) {
  return (rawQuestions ?? []).map((question, index) => {
    const questionNumber = index + 1;
    const prompt = String(question.prompt ?? '').trim();
    const options = (question.options ?? []).map((option) => String(option ?? '').trim()).filter(Boolean);
    const correctOptionIndex = Number(question.correctOptionIndex);

    if (!prompt) {
      throw new Error(`Question ${questionNumber} is missing the question text.`);
    }

    if (options.length < 2) {
      throw new Error(`Question ${questionNumber} needs at least 2 options.`);
    }

    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      throw new Error(`Question ${questionNumber} has an invalid correct answer selection.`);
    }

    return {
      correctOptionIndex,
      options,
      prompt,
    };
  });
}

function deriveRiskLevel(flaggedSessions: number, highestScore: number): SessionRiskLevel {
  if (flaggedSessions >= 3 || highestScore >= 75) {
    return 'high';
  }

  if (flaggedSessions > 0 || highestScore >= 45) {
    return 'medium';
  }

  return 'low';
}

function normalizeExamStatusForCurrentWindow({
  nowTimestamp,
  scheduledEndIso,
  scheduledStartIso,
  status,
}: {
  nowTimestamp: number;
  scheduledEndIso: string;
  scheduledStartIso: string;
  status: ExamStatus;
}): ExamStatus {
  if (status === 'cancelled' || status === 'draft') {
    return status;
  }

  const startTimestamp = new Date(scheduledStartIso).getTime();
  const endTimestamp = new Date(scheduledEndIso).getTime();
  const hasStarted = !Number.isNaN(startTimestamp) && startTimestamp <= nowTimestamp;
  const hasEnded = !Number.isNaN(endTimestamp) && endTimestamp <= nowTimestamp;

  if (status === 'completed' || hasEnded) {
    return 'completed';
  }

  if (status === 'live' || hasStarted) {
    return 'live';
  }

  return 'scheduled';
}

async function getCurrentProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in. Please sign in again.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, institutional_id, department_name')
    .eq('id', user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw new Error('Unable to load your staff profile. Contact admin support.');
  }

  ensureInvigilatorRole(profile.role);

  return profile;
}

function normalizeSessionRow(row: InvigilatorLiveOverviewRow): InvigilatorLiveSession {
  const flaggedSessions = toNumber(row.flagged_sessions);
  const highestScore = toNumber(row.highest_score);

  return {
    code: row.course_code,
    examId: row.exam_id,
    flaggedSessions,
    highestScore,
    liveSessions: toNumber(row.live_sessions),
    monitoringMode: row.monitoring_mode,
    registeredStudents: toNumber(row.registered_students),
    riskLevel: deriveRiskLevel(flaggedSessions, highestScore),
    scheduledStart: row.scheduled_start,
    status: row.status,
    title: row.exam_title || row.course_title,
  };
}

function roleToLevel(role: AppRole) {
  if (role === 'admin') {
    return 'L3';
  }

  if (role === 'invigilator') {
    return 'L2';
  }

  return 'L1';
}

async function getInvigilatorExamIds(profileId: string) {
  const [{ data: assignedRows, error: assignedError }, { data: createdRows, error: createdError }] =
    await Promise.all([
      supabase
        .from('exam_invigilators')
        .select('exam_id')
        .eq('invigilator_id', profileId)
        .returns<ExamInvigilatorRow[]>(),
      supabase.from('exams').select('id').eq('created_by', profileId).returns<ExamIdRow[]>(),
    ]);

  if (assignedError) {
    throw new Error(`Unable to load assigned sessions: ${assignedError.message}`);
  }

  if (createdError) {
    throw new Error(`Unable to load created sessions: ${createdError.message}`);
  }

  return Array.from(
    new Set([...(assignedRows ?? []).map((row) => row.exam_id), ...(createdRows ?? []).map((row) => row.id)])
  );
}

async function createExamQuestions({
  createdBy,
  examId,
  questions,
}: {
  createdBy: string;
  examId: string;
  questions: CreateExamQuestionInput[];
}) {
  for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
    const question = questions[questionIndex];

    const { data: insertedQuestion, error: insertQuestionError } = await supabase
      .from('exam_questions')
      .insert({
        created_by: createdBy,
        exam_id: examId,
        prompt: question.prompt,
        question_order: questionIndex + 1,
      })
      .select('id')
      .single<ExamQuestionInsertRow>();

    if (insertQuestionError || !insertedQuestion) {
      throw new Error(
        `Session created, but question ${questionIndex + 1} failed to save: ${
          insertQuestionError?.message ?? 'Unknown error.'
        }`
      );
    }

    const { data: insertedOptions, error: insertOptionsError } = await supabase
      .from('exam_question_options')
      .insert(
        question.options.map((option, optionIndex) => ({
          option_order: optionIndex + 1,
          option_text: option,
          question_id: insertedQuestion.id,
        }))
      )
      .select('id, option_order')
      .returns<ExamQuestionOptionInsertRow[]>();

    if (insertOptionsError || !insertedOptions || insertedOptions.length === 0) {
      throw new Error(
        `Session created, but options for question ${questionIndex + 1} failed to save: ${
          insertOptionsError?.message ?? 'Unknown error.'
        }`
      );
    }

    const correctOption = insertedOptions.find(
      (optionRow) => optionRow.option_order === question.correctOptionIndex + 1
    );

    if (!correctOption) {
      throw new Error(
        `Session created, but answer key for question ${questionIndex + 1} could not be matched.`
      );
    }

    const { error: answerKeyError } = await supabase.from('exam_question_answer_keys').insert({
      correct_option_id: correctOption.id,
      question_id: insertedQuestion.id,
    });

    if (answerKeyError) {
      throw new Error(
        `Session created, but answer key for question ${questionIndex + 1} failed to save: ${answerKeyError.message}`
      );
    }
  }
}

const MONITOR_RISK_WEIGHT: Record<MonitorRiskLevel, number> = {
  critical: 4,
  high: 3,
  low: 1,
  medium: 2,
};

function deriveMonitorRiskLevel(
  maxScore: number,
  suspiciousEventCount: number,
  finalLabel: AnalysisLabel | null
): MonitorRiskLevel {
  if (maxScore >= 90 || suspiciousEventCount >= 4) {
    return 'critical';
  }

  if (maxScore >= 75 || finalLabel === 'SUSPICIOUS' || suspiciousEventCount >= 2) {
    return 'high';
  }

  if (maxScore >= 45 || finalLabel === 'CAUTION' || suspiciousEventCount >= 1) {
    return 'medium';
  }

  return 'low';
}

function deriveMonitorIndicators({
  finalLabel,
  latestObservation,
  riskLevel,
}: {
  finalLabel: AnalysisLabel | null;
  latestObservation: string;
  riskLevel: MonitorRiskLevel;
}) {
  const observation = latestObservation.trim().toLowerCase();
  const gazeHint = /gaze|eye|off-screen|screen/.test(observation);
  const faceHint = /face|identity|camera/.test(observation);
  const audioHint = /audio|noise|sound|voice/.test(observation);
  const multiFaceHint = /multi|multiple|second face|two faces|person/.test(observation);

  const isCritical = riskLevel === 'critical';
  const isHigh = riskLevel === 'high';

  return {
    audio: audioHint || isCritical ? 'alert' : 'ok',
    face:
      finalLabel === 'NO_FACE' || finalLabel === 'SUSPICIOUS' || faceHint || isCritical
        ? 'alert'
        : 'ok',
    gaze: gazeHint || isHigh || isCritical ? 'alert' : 'ok',
    multiFace: multiFaceHint || finalLabel === 'SUSPICIOUS' || isCritical ? 'alert' : 'ok',
  } as const;
}

function normalizeMonitorRiskLevel(value: string): MonitorRiskLevel {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') {
    return 'critical';
  }

  if (normalized === 'high') {
    return 'high';
  }

  if (normalized === 'medium') {
    return 'medium';
  }

  return 'low';
}

function toStudentInitials(fullName: string) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'ST';
}

function isActiveSessionStatus(status: SessionStatus | null) {
  return status === 'pending' || status === 'active' || status === 'paused';
}

function isDoneSessionStatus(status: SessionStatus | null) {
  return status === 'submitted' || status === 'completed' || status === 'terminated';
}

function isActiveRegistrationStatus(status: string) {
  return status === 'checked_in' || status === 'active';
}

function isDoneRegistrationStatus(status: string) {
  return (
    status === 'submitted' ||
    status === 'completed' ||
    status === 'absent' ||
    status === 'cancelled'
  );
}

export async function fetchInvigilatorDashboardData(): Promise<InvigilatorDashboardData> {
  const profile = await getCurrentProfile();
  const examIds = await getInvigilatorExamIds(profile.id);

  if (examIds.length === 0) {
    return {
      sessions: [],
      staffInstitutionalId: profile.institutional_id,
      staffName: profile.full_name,
      stats: {
        active: 0,
        done: 0,
        flagged: 0,
        online: 0,
        totalSessions: 0,
      },
    };
  }

  await syncExamLifecycleStatuses();

  const [{ data: overviewRows, error: overviewError }, { data: examTimingRows, error: timingError }] =
    await Promise.all([
      supabase
        .from('invigilator_live_overview')
        .select(
          'exam_id, course_code, course_title, exam_title, status, monitoring_mode, scheduled_start, registered_students, live_sessions, flagged_sessions, highest_score'
        )
        .in('exam_id', examIds)
        .neq('status', 'cancelled')
        .order('scheduled_start', { ascending: true })
        .returns<InvigilatorLiveOverviewRow[]>(),
      supabase
        .from('exams')
        .select('id, status, scheduled_start, scheduled_end')
        .in('id', examIds)
        .returns<ExamTimingRow[]>(),
    ]);

  if (overviewError) {
    throw new Error(`Unable to load dashboard sessions: ${overviewError.message}`);
  }

  if (timingError) {
    throw new Error(`Unable to load dashboard exam timing: ${timingError.message}`);
  }

  const now = Date.now();
  const timingByExamId = new Map((examTimingRows ?? []).map((row) => [row.id, row]));

  const allSessions = (overviewRows ?? []).map((row) => {
    const normalized = normalizeSessionRow(row);
    const timing = timingByExamId.get(row.exam_id);
    const effectiveStatus = timing
      ? normalizeExamStatusForCurrentWindow({
          nowTimestamp: now,
          scheduledEndIso: timing.scheduled_end,
          scheduledStartIso: timing.scheduled_start,
          status: normalized.status,
        })
      : normalized.status;

    return {
      ...normalized,
      status: effectiveStatus,
    };
  });
  const liveSessions = allSessions.filter((session) => session.status === 'live' || session.status === 'scheduled');

  return {
    sessions: liveSessions,
    staffInstitutionalId: profile.institutional_id,
    staffName: profile.full_name,
    stats: {
      active: liveSessions.filter((session) => session.status === 'live').length,
      done: allSessions.filter((session) => session.status === 'completed').length,
      flagged: liveSessions.reduce((total, session) => total + session.flaggedSessions, 0),
      online: liveSessions.reduce((total, session) => total + session.liveSessions, 0),
      totalSessions: liveSessions.length,
    },
  };
}

export async function fetchInvigilatorProfileData(): Promise<InvigilatorProfileData> {
  const profile = await getCurrentProfile();
  const examIds = await getInvigilatorExamIds(profile.id);
  await syncExamLifecycleStatuses();

  let sessions = 0;
  let flaggedSessions = 0;
  let averageTrust = 100;

  if (examIds.length > 0) {
    const [{ data: overviewRows, error: overviewError }, { data: scoreRows, error: scoreError }] =
      await Promise.all([
        supabase
          .from('invigilator_live_overview')
          .select('exam_id, flagged_sessions, status')
          .in('exam_id', examIds)
          .neq('status', 'cancelled')
          .returns<InvigilatorProfileOverviewRow[]>(),
        supabase
          .from('analysis_sessions')
          .select('max_score')
          .in('exam_id', examIds)
          .returns<AnalysisScoreRow[]>(),
      ]);

    if (overviewError) {
      throw new Error(`Unable to load profile overview: ${overviewError.message}`);
    }

    if (scoreError) {
      throw new Error(`Unable to load trust statistics: ${scoreError.message}`);
    }

    const validOverviewRows = overviewRows ?? [];
    sessions = validOverviewRows.length;
    flaggedSessions = validOverviewRows.reduce(
      (total, row) => total + toNumber(row.flagged_sessions),
      0
    );

    const scores = (scoreRows ?? []).map((row) => toNumber(row.max_score));
    if (scores.length > 0) {
      const averageRisk = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      averageTrust = Math.max(0, Math.round(100 - averageRisk));
    }
  }

  const { data: unreadRows, error: unreadError } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', profile.id)
    .is('read_at', null)
    .returns<NotificationRow[]>();

  if (unreadError) {
    throw new Error(`Unable to load notifications: ${unreadError.message}`);
  }

  return {
    departmentName: profile.department_name ?? null,
    role: profile.role,
    staffId: profile.institutional_id,
    staffName: profile.full_name,
    stats: {
      averageTrust,
      flaggedSessions,
      level: roleToLevel(profile.role),
      sessions,
    },
    unreadNotifications: (unreadRows ?? []).length,
  };
}

export async function fetchInvigilatorMonitorData(
  examIdInput: string
): Promise<InvigilatorMonitorData> {
  const examId = examIdInput.trim();
  if (!examId) {
    throw new Error('No exam session selected.');
  }

  await syncExamLifecycleStatuses();
  await getCurrentProfile();

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, status, monitoring_mode, course_id, scheduled_start, scheduled_end')
    .eq('id', examId)
    .single<ExamRow>();

  if (examError || !exam) {
    throw new Error(`Unable to load exam session: ${examError?.message ?? 'Not found.'}`);
  }

  const effectiveExamStatus = normalizeExamStatusForCurrentWindow({
    nowTimestamp: Date.now(),
    scheduledEndIso: exam.scheduled_end,
    scheduledStartIso: exam.scheduled_start,
    status: exam.status,
  });
  const examHasEnded = effectiveExamStatus === 'completed';

  const [{ data: course, error: courseError }, { data: registrations, error: registrationsError }] =
    await Promise.all([
      supabase.from('courses').select('id, code, title').eq('id', exam.course_id).maybeSingle<CourseRow>(),
      supabase
        .from('exam_registrations')
        .select('student_id, registration_status')
        .eq('exam_id', exam.id)
        .returns<ExamRegistrationRow[]>(),
    ]);

  if (courseError) {
    throw new Error(`Unable to load course details: ${courseError.message}`);
  }

  if (registrationsError) {
    throw new Error(`Unable to load student registrations: ${registrationsError.message}`);
  }

  const registrationRows = registrations ?? [];
  const studentIds = Array.from(new Set(registrationRows.map((row) => row.student_id)));

  let studentProfiles: StudentProfileRow[] = [];
  let analysisRows: AnalysisSessionRow[] = [];

  if (studentIds.length > 0) {
    const [profilesResult, analysisResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, institutional_id')
        .in('id', studentIds)
        .returns<StudentProfileRow[]>(),
      supabase
        .from('analysis_sessions')
        .select(
          'student_id, status, max_score, final_label, suspicious_event_count, latest_observation, started_at'
        )
        .eq('exam_id', exam.id)
        .in('student_id', studentIds)
        .order('started_at', { ascending: false })
        .returns<AnalysisSessionRow[]>(),
    ]);

    if (profilesResult.error) {
      throw new Error(`Unable to load student profiles: ${profilesResult.error.message}`);
    }

    if (analysisResult.error) {
      throw new Error(`Unable to load student analysis data: ${analysisResult.error.message}`);
    }

    studentProfiles = profilesResult.data ?? [];
    analysisRows = analysisResult.data ?? [];
  }

  const profileByStudentId = new Map(studentProfiles.map((profile) => [profile.id, profile]));
  const latestSessionByStudentId = new Map<string, AnalysisSessionRow>();

  for (const sessionRow of analysisRows) {
    if (!latestSessionByStudentId.has(sessionRow.student_id)) {
      latestSessionByStudentId.set(sessionRow.student_id, sessionRow);
    }
  }

  const students = registrationRows.map<InvigilatorMonitorStudent>((registration) => {
    const profile = profileByStudentId.get(registration.student_id);
    const latestSession = latestSessionByStudentId.get(registration.student_id);
    const registrationStatus = String(registration.registration_status ?? 'registered')
      .trim()
      .toLowerCase();
    const sessionStatus = latestSession?.status ?? null;
    const score = toNumber(latestSession?.max_score);
    const suspiciousEventCount = toNumber(latestSession?.suspicious_event_count);
    const finalLabel = latestSession?.final_label ?? null;
    const riskLevel = deriveMonitorRiskLevel(score, suspiciousEventCount, finalLabel);
    const institutionalId =
      String(profile?.institutional_id ?? '')
        .trim()
        .toUpperCase() || registration.student_id.slice(0, 8).toUpperCase();
    const fullName = String(profile?.full_name ?? '').trim() || `Student ${institutionalId}`;
    const isActive =
      !examHasEnded &&
      (isActiveSessionStatus(sessionStatus) ||
        (!sessionStatus && isActiveRegistrationStatus(registrationStatus)));
    const isDone =
      examHasEnded ||
      isDoneSessionStatus(sessionStatus) ||
      (!sessionStatus && isDoneRegistrationStatus(registrationStatus));

    return {
      indicators: deriveMonitorIndicators({
        finalLabel,
        latestObservation: latestSession?.latest_observation ?? '',
        riskLevel,
      }),
      initials: toStudentInitials(fullName),
      institutionalId,
      isActive,
      isCritical: riskLevel === 'critical',
      isDone,
      isFlagged: riskLevel !== 'low',
      name: fullName,
      riskLevel,
      score,
      status: String(sessionStatus ?? registrationStatus).replace(/_/g, ' ').toUpperCase(),
      studentId: registration.student_id,
    };
  });

  students.sort((left, right) => {
    const riskDelta = MONITOR_RISK_WEIGHT[right.riskLevel] - MONITOR_RISK_WEIGHT[left.riskLevel];
    if (riskDelta !== 0) {
      return riskDelta;
    }

    const scoreDelta = right.score - left.score;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.name.localeCompare(right.name);
  });

  return {
    courseCode: String(course?.code ?? 'COURSE').toUpperCase(),
    examId: exam.id,
    examStatus: effectiveExamStatus,
    monitorMode: exam.monitoring_mode,
    stats: {
      active: students.filter((student) => student.isActive).length,
      critical: students.filter((student) => student.isCritical).length,
      done: students.filter((student) => student.isDone).length,
      flagged: students.filter((student) => student.isFlagged).length,
      total: students.length,
    },
    students,
    title: exam.title || course?.title || 'Exam Session',
  };
}

export async function fetchInvigilatorSuspiciousEvents(
  examIdInput: string
): Promise<InvigilatorSuspiciousEvent[]> {
  const examId = examIdInput.trim();
  if (!examId) {
    throw new Error('No exam session selected.');
  }

  await getCurrentProfile();

  const queryFields =
    'id, student_id, label, reason, risk_level, start_timestamp_seconds, end_timestamp_seconds, max_score, created_at, evidence';
  const { data: eventRowsWithEvidence, error: evidenceError } = await supabase
    .from('suspicious_events')
    .select(queryFields)
    .eq('exam_id', examId)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<SuspiciousEventRow[]>();

  let eventRows = eventRowsWithEvidence ?? [];

  if (evidenceError) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('suspicious_events')
      .select(
        'id, student_id, label, reason, risk_level, start_timestamp_seconds, end_timestamp_seconds, max_score, created_at'
      )
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<SuspiciousEventRow[]>();

    if (fallbackError) {
      throw new Error(`Unable to load suspicious events: ${fallbackError.message}`);
    }

    eventRows = fallbackRows ?? [];
  }

  const studentIds = Array.from(new Set(eventRows.map((eventRow) => eventRow.student_id)));
  let profileById = new Map<string, StudentProfileRow>();

  if (studentIds.length > 0) {
    const { data: studentProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, institutional_id')
      .in('id', studentIds)
      .returns<StudentProfileRow[]>();

    if (profilesError) {
      throw new Error(`Unable to load suspicious event students: ${profilesError.message}`);
    }

    profileById = new Map((studentProfiles ?? []).map((profile) => [profile.id, profile]));
  }

  const mappedEvents = await Promise.all(
    eventRows.map(async (eventRow) => {
      const profile = profileById.get(eventRow.student_id);
      const evidence = parseSuspiciousEvidence(eventRow.evidence);
      const requestedLeadSeconds = Math.max(0, toNumber(evidence?.requestedLeadSeconds));
      const requestedTrailSeconds = Math.max(0, toNumber(evidence?.requestedTrailSeconds));
      const eventDurationSeconds = Math.max(
        0.25,
        toNumber(eventRow.end_timestamp_seconds) - toNumber(eventRow.start_timestamp_seconds)
      );
      const windowStartMs = toTimestampMs(evidence?.windowStartIso ?? null);
      const eventStartMs =
        windowStartMs === null ? null : windowStartMs + requestedLeadSeconds * 1000;
      const eventEndMs =
        eventStartMs === null ? null : eventStartMs + eventDurationSeconds * 1000;

      const resolvedSegments = await Promise.all(
        (evidence?.segments ?? []).map(async (segment) => {
          const publicUrlFromEvidence =
            typeof segment.publicUrl === 'string' && segment.publicUrl.trim().length > 0
              ? segment.publicUrl.trim()
              : null;

          const { data: signedUrlData } = await supabase.storage
            .from(SUSPICIOUS_CLIP_BUCKET)
            .createSignedUrl(segment.path, 60 * 60);
          let resolvedVideoUrl = signedUrlData?.signedUrl ?? null;

          if (!resolvedVideoUrl) {
            resolvedVideoUrl = publicUrlFromEvidence;
          }

          if (!resolvedVideoUrl) {
            const { data: publicUrlData } = supabase.storage
              .from(SUSPICIOUS_CLIP_BUCKET)
              .getPublicUrl(segment.path);
            resolvedVideoUrl = publicUrlData.publicUrl ?? null;
          }

          return {
            durationSeconds: segment.durationSeconds,
            endedAtIso: segment.endedAtIso,
            path: segment.path,
            role: 'context',
            videoUrl: resolvedVideoUrl,
            startedAtIso: segment.startedAtIso,
          } satisfies InvigilatorSuspiciousClipSegment;
        })
      );

      const segments = resolvedSegments
        .map((segment) => {
          const segmentStartMs = toTimestampMs(segment.startedAtIso);
          const segmentEndMs = toTimestampMs(segment.endedAtIso);
          let role: InvigilatorSuspiciousClipRole = 'context';

          if (
            segmentStartMs !== null &&
            segmentEndMs !== null &&
            eventStartMs !== null &&
            eventEndMs !== null
          ) {
            if (segmentEndMs > eventStartMs && segmentStartMs < eventEndMs) {
              role = 'event';
            } else if (segmentEndMs <= eventStartMs) {
              role = 'context-before';
            } else if (segmentStartMs >= eventEndMs) {
              role = 'context-after';
            }
          }

          return {
            ...segment,
            role,
          } satisfies InvigilatorSuspiciousClipSegment;
        })
        .sort((left, right) => {
          const roleWeight: Record<InvigilatorSuspiciousClipRole, number> = {
            event: 0,
            'context-before': 1,
            'context-after': 2,
            context: 3,
          };
          const roleDelta = roleWeight[left.role] - roleWeight[right.role];
          if (roleDelta !== 0) {
            return roleDelta;
          }

          const leftStartMs = toTimestampMs(left.startedAtIso) ?? 0;
          const rightStartMs = toTimestampMs(right.startedAtIso) ?? 0;
          return leftStartMs - rightStartMs;
        });

      const institutionalId =
        String(profile?.institutional_id ?? '')
          .trim()
          .toUpperCase() || eventRow.student_id.slice(0, 8).toUpperCase();
      const studentName = String(profile?.full_name ?? '').trim() || `Student ${institutionalId}`;

      return {
        createdAt: eventRow.created_at,
        endTimestampSeconds: toNumber(eventRow.end_timestamp_seconds),
        id: eventRow.id,
        label: eventRow.label,
        maxScore: toNumber(eventRow.max_score),
        reason: eventRow.reason,
        riskLevel: normalizeMonitorRiskLevel(String(eventRow.risk_level ?? 'medium')),
        requestedLeadSeconds,
        requestedTrailSeconds,
        segments,
        startTimestampSeconds: toNumber(eventRow.start_timestamp_seconds),
        studentId: eventRow.student_id,
        studentInstitutionalId: institutionalId,
        studentName,
        wasTruncated: Boolean(evidence?.wasTruncated),
        windowEndIso: evidence?.windowEndIso || null,
        windowStartIso: evidence?.windowStartIso || null,
      } satisfies InvigilatorSuspiciousEvent;
    })
  );

  mappedEvents.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return mappedEvents;
}

export async function createExamSession(
  input: CreateExamSessionInput
): Promise<CreateExamSessionResult> {
  const profile = await getCurrentProfile();

  const courseCode = input.courseCode.trim().toUpperCase();
  const courseTitle = input.courseTitle.trim();
  const durationHours = Number(input.durationHours);
  const maxStudents = Math.trunc(Number(input.maxStudents));
  const questions = normalizeCreateExamQuestions(input.questions);

  if (!courseCode) {
    throw new Error('Enter a course code.');
  }

  if (!courseTitle) {
    throw new Error('Enter a course name.');
  }

  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new Error('Duration must be a positive number of hours.');
  }

  if (!Number.isFinite(maxStudents) || maxStudents <= 0) {
    throw new Error('Max students must be a positive whole number.');
  }

  const scheduledStartIso = parseScheduledStart(input.examDate, input.startTime);
  const scheduledStartDate = new Date(scheduledStartIso);
  const durationMinutes = Math.max(1, Math.round(durationHours * 60));
  const status: ExamStatus = scheduledStartDate.getTime() <= Date.now() ? 'live' : 'scheduled';

  const { data: existingCourse, error: existingCourseError } = await supabase
    .from('courses')
    .select('id, title')
    .eq('code', courseCode)
    .maybeSingle<CourseRow>();

  if (existingCourseError) {
    throw new Error(`Unable to load course: ${existingCourseError.message}`);
  }

  let courseId = existingCourse?.id;

  if (!courseId) {
    const { data: insertedCourse, error: insertCourseError } = await supabase
      .from('courses')
      .insert({
        code: courseCode,
        created_by: profile.id,
        title: courseTitle,
      })
      .select('id')
      .single<ExamIdRow>();

    if (insertCourseError || !insertedCourse) {
      throw new Error(`Unable to create course: ${insertCourseError?.message ?? 'Unknown error.'}`);
    }

    courseId = insertedCourse.id;
  } else if (existingCourse && existingCourse.title !== courseTitle) {
    const { error: updateCourseError } = await supabase
      .from('courses')
      .update({ title: courseTitle })
      .eq('id', courseId);

    if (updateCourseError) {
      throw new Error(`Unable to update course title: ${updateCourseError.message}`);
    }
  }

  const { data: insertedExam, error: insertExamError } = await supabase
    .from('exams')
    .insert({
      course_id: courseId,
      created_by: profile.id,
      duration_minutes: durationMinutes,
      max_students: maxStudents,
      monitoring_mode: input.monitoringMode,
      scheduled_start: scheduledStartIso,
      status,
      title: courseTitle,
    })
    .select('id')
    .single<ExamIdRow>();

  if (insertExamError || !insertedExam) {
    throw new Error(`Unable to create exam session: ${insertExamError?.message ?? 'Unknown error.'}`);
  }

  const { error: assignError } = await supabase.from('exam_invigilators').upsert(
    {
      assigned_by: profile.id,
      exam_id: insertedExam.id,
      invigilator_id: profile.id,
    },
    { onConflict: 'exam_id,invigilator_id' }
  );

  if (assignError) {
    throw new Error(`Session created, but assignment failed: ${assignError.message}`);
  }

  if (questions.length > 0) {
    await createExamQuestions({
      createdBy: profile.id,
      examId: insertedExam.id,
      questions,
    });
  }

  const requestedStudentIds = Array.from(
    new Set((input.studentInstitutionalIds ?? []).map(normalizeInstitutionalId).filter(Boolean))
  );

  const { data: studentProfiles, error: studentsError } = await supabase
    .from('profiles')
    .select('id, institutional_id, email, metadata')
    .eq('role', 'student')
    .returns<StudentProfileRow[]>();

  if (studentsError) {
    throw new Error(`Session created, but student lookup failed: ${studentsError.message}`);
  }

  const studentProfilesList = studentProfiles ?? [];
  let validProfiles = studentProfilesList;
  let missingStudentIds: string[] = [];

  if (requestedStudentIds.length > 0) {
    const tokenToProfile = new Map<string, StudentProfileRow>();

    for (const profileRow of studentProfilesList) {
      for (const token of profileLookupTokens(profileRow)) {
        if (!tokenToProfile.has(token)) {
          tokenToProfile.set(token, profileRow);
        }
      }
    }

    const validProfileById = new Map<string, StudentProfileRow>();
    missingStudentIds = [];

    for (const requestedId of requestedStudentIds) {
      const matchedProfile = tokenToProfile.get(requestedId);
      if (matchedProfile) {
        validProfileById.set(matchedProfile.id, matchedProfile);
      } else {
        missingStudentIds.push(requestedId);
      }
    }

    validProfiles = Array.from(validProfileById.values());
  }

  if (validProfiles.length > 0) {
    const { error: registrationError } = await supabase.from('exam_registrations').upsert(
      validProfiles.map((studentProfile) => ({
        exam_id: insertedExam.id,
        registration_status: 'registered',
        student_id: studentProfile.id,
      })),
      { onConflict: 'exam_id,student_id' }
    );

    if (registrationError) {
      throw new Error(`Session created, but registration failed: ${registrationError.message}`);
    }
  }

  return {
    examId: insertedExam.id,
    missingStudentIds,
    registeredCount: validProfiles.length,
  };
}
