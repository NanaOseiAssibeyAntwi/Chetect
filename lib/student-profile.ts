import { supabase } from '@/lib/supabase';

type AppRole = 'student' | 'invigilator' | 'admin';

type StudentProfileRow = {
  department_name: string | null;
  full_name: string;
  id: string;
  institutional_id: string | null;
  role: AppRole;
};

type StudentResultRow = {
  score_percent: number | null;
};

type NotificationRow = {
  body?: string;
  created_at?: string;
  data?: Record<string, unknown> | null;
  id: string;
  notification_type?: string;
  read_at?: string | null;
  title?: string;
};

type StudentSessionHistoryRow = {
  attempt_id: string;
  correct_answers: number | null;
  course_code: string | null;
  course_title: string | null;
  exam_id: string;
  exam_title: string | null;
  remark: string | null;
  score_percent: number | null;
  submitted_at: string;
  total_questions: number | null;
};

export type StudentProfileData = {
  departmentName: string | null;
  role: AppRole;
  stats: {
    averageScore: number;
    examsTaken: number;
    integrity: number;
  };
  studentId: string | null;
  studentName: string;
  unreadNotifications: number;
};

export type StudentNotificationItem = {
  body: string;
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  isRead: boolean;
  title: string;
  type: string;
};

export type StudentSessionHistoryItem = {
  attemptId: string;
  correctAnswers: number;
  courseCode: string;
  courseTitle: string;
  examId: string;
  examTitle: string;
  integrity: number;
  remark: string;
  scorePercent: number;
  submittedAt: string;
  totalQuestions: number;
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function getCurrentStudentUser() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in. Please sign in again.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single<{ id: string; role: AppRole }>();

  if (profileError || !profile) {
    throw new Error('Unable to load your student profile.');
  }

  if (profile.role !== 'student') {
    throw new Error('This account is not authorized for student access.');
  }

  return user;
}

export async function fetchStudentProfileData(): Promise<StudentProfileData> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in. Please sign in again.');
  }

  const [{ data: profile, error: profileError }, { data: resultRows, error: resultsError }, { data: unreadRows, error: unreadError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, institutional_id, department_name, role')
        .eq('id', user.id)
        .single<StudentProfileRow>(),
      supabase
        .from('student_exam_results')
        .select('score_percent')
        .eq('student_id', user.id)
        .eq('attempt_status', 'submitted')
        .returns<StudentResultRow[]>(),
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .is('read_at', null)
        .returns<NotificationRow[]>(),
    ]);

  if (profileError || !profile) {
    throw new Error('Unable to load your student profile.');
  }

  if (profile.role !== 'student') {
    throw new Error('This account is not authorized for student profile access.');
  }

  if (resultsError) {
    throw new Error(`Unable to load your exam history: ${resultsError.message}`);
  }

  if (unreadError) {
    throw new Error(`Unable to load your notifications: ${unreadError.message}`);
  }

  const scores = (resultRows ?? []).map((row) => toNumber(row.score_percent));
  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const integrity = scores.length > 0 ? Math.max(0, Math.round(100 - averageScore)) : 100;

  return {
    departmentName: profile.department_name,
    role: profile.role,
    stats: {
      averageScore,
      examsTaken: scores.length,
      integrity,
    },
    studentId: profile.institutional_id,
    studentName: profile.full_name,
    unreadNotifications: (unreadRows ?? []).length,
  };
}

export async function fetchStudentNotifications(): Promise<StudentNotificationItem[]> {
  const user = await getCurrentStudentUser();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, notification_type, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<NotificationRow[]>();

  if (error) {
    throw new Error(`Unable to load notifications: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    body: String(row.body ?? '').trim() || 'No notification details available.',
    createdAt: String(row.created_at ?? ''),
    data: row.data ?? {},
    id: row.id,
    isRead: Boolean(row.read_at),
    title: String(row.title ?? '').trim() || 'Notification',
    type: String(row.notification_type ?? '').trim() || 'general',
  }));
}

export async function fetchStudentSessionHistory(): Promise<StudentSessionHistoryItem[]> {
  const user = await getCurrentStudentUser();

  const { data, error } = await supabase
    .from('student_exam_results')
    .select(
      'attempt_id, exam_id, course_code, course_title, exam_title, score_percent, correct_answers, total_questions, remark, submitted_at'
    )
    .eq('student_id', user.id)
    .eq('attempt_status', 'submitted')
    .order('submitted_at', { ascending: false })
    .returns<StudentSessionHistoryRow[]>();

  if (error) {
    throw new Error(`Unable to load session history: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const scorePercent = toNumber(row.score_percent);

    return {
      attemptId: row.attempt_id,
      correctAnswers: toNumber(row.correct_answers),
      courseCode: String(row.course_code ?? '').trim().toUpperCase() || 'COURSE',
      courseTitle: String(row.course_title ?? '').trim() || 'Course',
      examId: row.exam_id,
      examTitle: String(row.exam_title ?? '').trim() || 'Exam Session',
      integrity: Math.max(0, Math.round(100 - scorePercent)),
      remark: String(row.remark ?? '').trim() || 'No remark available.',
      scorePercent,
      submittedAt: row.submitted_at,
      totalQuestions: Math.max(1, toNumber(row.total_questions)),
    };
  });
}

export async function changeStudentPassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await getCurrentStudentUser();
  const email = String(user.email ?? '').trim();

  if (!email) {
    throw new Error('Your account email is unavailable. Contact academic IT.');
  }

  if (!currentPassword) {
    throw new Error('Enter your current password.');
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }

  if (currentPassword === newPassword) {
    throw new Error('New password must be different from your current password.');
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    throw new Error('Current password is incorrect.');
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw new Error(`Unable to change password: ${updateError.message}`);
  }
}
