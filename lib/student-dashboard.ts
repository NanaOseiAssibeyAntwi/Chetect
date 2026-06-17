import { supabase } from '@/lib/supabase';
import { syncExamLifecycleStatuses } from '@/lib/exam-lifecycle';

type AppRole = 'student' | 'invigilator' | 'admin';
type ExamStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';

type StudentProfileRow = {
  department_name: string | null;
  full_name: string;
  id: string;
  institutional_id: string | null;
  role: AppRole;
};

type StudentExamScheduleRow = {
  course_code: string;
  course_title: string;
  exam_id: string;
  exam_title: string;
  latest_final_label: string | null;
  latest_max_score: number | null;
  latest_session_status: string | null;
  monitoring_mode: string;
  registration_status: string;
  scheduled_end: string;
  scheduled_start: string;
  status: ExamStatus;
};

type NotificationRow = {
  id: string;
};

export type StudentDashboardExam = {
  countdownToStart: string | null;
  examId: string;
  isLive: boolean;
  meta: string;
  status: ExamStatus;
  title: string;
  code: string;
};

export type StudentDashboardActivity = {
  date: string;
  integrity: string;
  score: string;
  title: string;
};

export type StudentDashboardData = {
  activity: StudentDashboardActivity[];
  exams: StudentDashboardExam[];
  stats: {
    avgScore: number;
    examsTaken: number;
    integrity: number;
  };
  studentId: string | null;
  studentName: string;
  unreadNotifications: number;
  upcomingCount: number;
};

function isDoneRegistrationStatus(status: string) {
  return ['submitted', 'completed', 'absent', 'cancelled'].includes(status);
}

function isDoneSessionStatus(status: string | null) {
  return status === 'submitted' || status === 'completed' || status === 'terminated';
}

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDuration(startIso: string, endIso: string) {
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '--';
  }

  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (60 * 1000)));
  if (minutes === 0) {
    return '--';
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;

  if (remMinutes === 0) {
    return `${hours}h`;
  }

  if (hours === 0) {
    return `${remMinutes}m`;
  }

  return `${hours}h ${remMinutes}m`;
}

function formatExamMeta(startIso: string, endIso: string) {
  const startDate = new Date(startIso);
  if (Number.isNaN(startDate.getTime())) {
    return 'Unknown schedule';
  }

  return `${startDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}   ${startDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })}   ${formatDuration(startIso, endIso)}`;
}

function formatActivityDate(startIso: string) {
  const startDate = new Date(startIso);
  if (Number.isNaN(startDate.getTime())) {
    return 'Unknown';
  }

  return startDate.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}

function formatStartsIn(startIso: string, nowTimestamp: number) {
  const startTimestamp = new Date(startIso).getTime();
  if (Number.isNaN(startTimestamp)) {
    return null;
  }

  const diffMs = startTimestamp - nowTimestamp;
  if (diffMs <= 0) {
    return 'Starting now';
  }

  const totalMinutes = Math.ceil(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `Starts in ${hours}h ${minutes}m`;
  }

  return `Starts in ${minutes}m`;
}

export async function fetchStudentDashboardData(): Promise<StudentDashboardData> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in. Please sign in again.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, institutional_id, department_name, role')
    .eq('id', user.id)
    .single<StudentProfileRow>();

  if (profileError || !profile) {
    throw new Error('Unable to load your student profile.');
  }

  if (profile.role !== 'student') {
    throw new Error('This account is not authorized for student dashboard access.');
  }

  await syncExamLifecycleStatuses();

  const [{ data: scheduleRows, error: scheduleError }, { data: unreadRows, error: unreadError }] =
    await Promise.all([
      supabase
        .from('student_exam_schedule')
        .select(
          'exam_id, course_code, course_title, exam_title, scheduled_start, scheduled_end, status, monitoring_mode, registration_status, latest_session_status, latest_final_label, latest_max_score'
        )
        .eq('student_id', profile.id)
        .order('scheduled_start', { ascending: true })
        .returns<StudentExamScheduleRow[]>(),
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .is('read_at', null)
        .returns<NotificationRow[]>(),
    ]);

  if (scheduleError) {
    throw new Error(`Unable to load exam schedule: ${scheduleError.message}`);
  }

  if (unreadError) {
    throw new Error(`Unable to load notifications: ${unreadError.message}`);
  }

  const rows = scheduleRows ?? [];
  const now = Date.now();
  const examRows = rows.filter((row) => {
    if (row.status !== 'live' && row.status !== 'scheduled') {
      return false;
    }

    const endTime = new Date(row.scheduled_end).getTime();
    const hasEnded = !Number.isNaN(endTime) && endTime <= now;
    return !hasEnded;
  });

  const exams = examRows.map<StudentDashboardExam>((row) => {
    const startTime = new Date(row.scheduled_start).getTime();
    const endTime = new Date(row.scheduled_end).getTime();
    const hasStarted = !Number.isNaN(startTime) && startTime <= now;
    const hasEnded = !Number.isNaN(endTime) && endTime <= now;
    const isLive = !hasEnded && (row.status === 'live' || hasStarted);

    return {
      code: row.course_code,
      countdownToStart: isLive ? null : formatStartsIn(row.scheduled_start, now),
      examId: row.exam_id,
      isLive,
      meta: formatExamMeta(row.scheduled_start, row.scheduled_end),
      status: row.status,
      title: row.exam_title || row.course_title,
    };
  });

  const completedRows = rows
    .filter(
      (row) => {
        const endTime = new Date(row.scheduled_end).getTime();
        const hasEnded = !Number.isNaN(endTime) && endTime <= now;

        return (
          row.status === 'completed' ||
          hasEnded ||
          isDoneRegistrationStatus(row.registration_status) ||
          isDoneSessionStatus(row.latest_session_status)
        );
      }
    )
    .sort(
      (left, right) =>
        new Date(right.scheduled_start).getTime() - new Date(left.scheduled_start).getTime()
    );

  const scoredRows = completedRows.filter((row) => row.latest_max_score !== null);
  const avgScore =
    scoredRows.length > 0
      ? Math.round(
          scoredRows.reduce((sum, row) => sum + toNumber(row.latest_max_score), 0) /
            scoredRows.length
        )
      : 0;
  const integrity = scoredRows.length > 0 ? Math.max(0, Math.round(100 - avgScore)) : 100;

  const activity = completedRows.slice(0, 5).map<StudentDashboardActivity>((row) => {
    const score = row.latest_max_score !== null ? Math.round(toNumber(row.latest_max_score)) : null;
    const integrityValue = score === null ? null : Math.max(0, 100 - score);

    return {
      date: formatActivityDate(row.scheduled_start),
      integrity: integrityValue === null ? '--' : String(integrityValue),
      score: score === null ? '--' : `${score}%`,
      title: row.exam_title || row.course_title,
    };
  });

  return {
    activity,
    exams,
    stats: {
      avgScore,
      examsTaken: completedRows.length,
      integrity,
    },
    studentId: profile.institutional_id,
    studentName: profile.full_name,
    unreadNotifications: (unreadRows ?? []).length,
    upcomingCount: examRows.length,
  };
}
