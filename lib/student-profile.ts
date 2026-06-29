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
  id: string;
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

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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
