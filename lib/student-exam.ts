import { supabase } from '@/lib/supabase';

type AppRole = 'student' | 'invigilator' | 'admin';
type ExamStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';
type MonitoringMode = 'standard' | 'strict' | 'minimal';

type StudentProfileRow = {
  full_name: string;
  id: string;
  institutional_id: string | null;
  role: AppRole;
};

type ExamRegistrationRow = {
  registration_status: string;
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

type CourseRow = {
  code: string | null;
  title: string;
};

type ExamQuestionRow = {
  id: string;
  prompt: string;
  question_order: number;
};

type ExamQuestionOptionRow = {
  id: string;
  option_order: number;
  option_text: string;
  question_id: string;
};

type ExamAttemptRow = {
  status: 'in_progress' | 'submitted';
  submitted_at: string | null;
};

type SubmitExamRpcRow = {
  attempt_id: string;
  correct_answers: number;
  exam_id: string;
  remark: string;
  score_percent: number;
  submitted_at: string;
  total_questions: number;
};

type StudentExamResultRow = {
  attempt_id: string;
  correct_answers: number;
  course_code: string;
  course_title: string;
  exam_id: string;
  exam_title: string;
  remark: string;
  score_percent: number;
  submitted_at: string;
  total_questions: number;
};

export type StudentExamOption = {
  id: string;
  label: string;
  text: string;
};

export type StudentExamQuestion = {
  id: string;
  options: StudentExamOption[];
  order: number;
  prompt: string;
};

export type StudentExamSessionData = {
  courseCode: string;
  courseTitle: string;
  examId: string;
  examTitle: string;
  hasSubmitted: boolean;
  monitoringMode: MonitoringMode;
  questions: StudentExamQuestion[];
  scheduledEnd: string;
  scheduledStart: string;
  status: ExamStatus;
  submittedAt: string | null;
};

export type SubmitStudentExamAnswerInput = {
  questionId: string;
  selectedOptionId: string | null;
};

export type StudentExamResultData = {
  attemptId: string;
  correctAnswers: number;
  courseCode: string;
  courseTitle: string;
  examId: string;
  examTitle: string;
  remark: string;
  scorePercent: number;
  submittedAt: string;
  totalQuestions: number;
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
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
    .select('id, full_name, institutional_id, role')
    .eq('id', user.id)
    .single<StudentProfileRow>();

  if (profileError || !profile) {
    throw new Error('Unable to load your student profile.');
  }

  if (profile.role !== 'student') {
    throw new Error('This account is not authorized for student exam access.');
  }

  return profile;
}

async function ensureStudentRegistration({
  examId,
  studentId,
}: {
  examId: string;
  studentId: string;
}) {
  const { data: registration, error: registrationError } = await supabase
    .from('exam_registrations')
    .select('registration_status')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .maybeSingle<ExamRegistrationRow>();

  if (registrationError) {
    throw new Error(`Unable to verify exam registration: ${registrationError.message}`);
  }

  if (!registration) {
    throw new Error('You are not registered for this exam session.');
  }

  const status = String(registration.registration_status ?? '').toLowerCase();
  if (status === 'cancelled' || status === 'absent') {
    throw new Error('This exam registration is not active.');
  }
}

export async function fetchStudentExamSessionData(
  examIdInput: string
): Promise<StudentExamSessionData> {
  const examId = examIdInput.trim();

  if (!examId) {
    throw new Error('No exam session selected.');
  }

  const profile = await getCurrentStudentProfile();
  await ensureStudentRegistration({ examId, studentId: profile.id });

  const [{ data: exam, error: examError }, { data: attempt, error: attemptError }] =
    await Promise.all([
      supabase
        .from('exams')
        .select('id, title, status, monitoring_mode, scheduled_start, scheduled_end, course_id')
        .eq('id', examId)
        .single<ExamRow>(),
      supabase
        .from('exam_attempts')
        .select('status, submitted_at')
        .eq('exam_id', examId)
        .eq('student_id', profile.id)
        .maybeSingle<ExamAttemptRow>(),
    ]);

  if (examError || !exam) {
    throw new Error(`Unable to load exam details: ${examError?.message ?? 'Not found.'}`);
  }

  if (attemptError) {
    throw new Error(`Unable to load exam attempt: ${attemptError.message}`);
  }

  if (exam.status === 'cancelled') {
    throw new Error('This exam session is cancelled.');
  }

  const [{ data: course, error: courseError }, { data: questionRows, error: questionsError }] =
    await Promise.all([
      supabase.from('courses').select('code, title').eq('id', exam.course_id).maybeSingle<CourseRow>(),
      supabase
        .from('exam_questions')
        .select('id, prompt, question_order')
        .eq('exam_id', exam.id)
        .order('question_order', { ascending: true })
        .returns<ExamQuestionRow[]>(),
    ]);

  if (courseError) {
    throw new Error(`Unable to load course details: ${courseError.message}`);
  }

  if (questionsError) {
    throw new Error(`Unable to load exam questions: ${questionsError.message}`);
  }

  const questions = questionRows ?? [];
  if (questions.length === 0) {
    throw new Error('This exam has no multiple-choice questions yet.');
  }

  const questionIds = questions.map((question) => question.id);
  const { data: optionRows, error: optionsError } = await supabase
    .from('exam_question_options')
    .select('id, question_id, option_order, option_text')
    .in('question_id', questionIds)
    .order('option_order', { ascending: true })
    .returns<ExamQuestionOptionRow[]>();

  if (optionsError) {
    throw new Error(`Unable to load answer options: ${optionsError.message}`);
  }

  const optionsByQuestionId = new Map<string, ExamQuestionOptionRow[]>();
  for (const optionRow of optionRows ?? []) {
    const existing = optionsByQuestionId.get(optionRow.question_id);
    if (existing) {
      existing.push(optionRow);
    } else {
      optionsByQuestionId.set(optionRow.question_id, [optionRow]);
    }
  }

  const mappedQuestions = questions.map<StudentExamQuestion>((question) => {
    const questionOptions = (optionsByQuestionId.get(question.id) ?? [])
      .slice()
      .sort((left, right) => left.option_order - right.option_order);

    return {
      id: question.id,
      options: questionOptions.map((option, optionIndex) => ({
        id: option.id,
        label: toOptionLabel(optionIndex),
        text: option.option_text,
      })),
      order: toNumber(question.question_order),
      prompt: question.prompt,
    };
  });

  return {
    courseCode: String(course?.code ?? '').toUpperCase() || 'COURSE',
    courseTitle: course?.title ?? exam.title,
    examId: exam.id,
    examTitle: exam.title || course?.title || 'Exam Session',
    hasSubmitted: attempt?.status === 'submitted',
    monitoringMode: exam.monitoring_mode,
    questions: mappedQuestions,
    scheduledEnd: exam.scheduled_end,
    scheduledStart: exam.scheduled_start,
    status: exam.status,
    submittedAt: attempt?.submitted_at ?? null,
  };
}

export async function submitStudentExamAnswers({
  answers,
  examIdInput,
}: {
  answers: SubmitStudentExamAnswerInput[];
  examIdInput: string;
}): Promise<StudentExamResultData> {
  const examId = examIdInput.trim();

  if (!examId) {
    throw new Error('No exam session selected.');
  }

  await getCurrentStudentProfile();

  const normalizedAnswers = answers
    .map((answer) => ({
      questionId: answer.questionId.trim(),
      selectedOptionId: answer.selectedOptionId?.trim() || null,
    }))
    .filter((answer) => answer.questionId);

  const { data, error } = await supabase
    .rpc('submit_exam_attempt', {
      submitted_answers: normalizedAnswers,
      target_exam_id: examId,
    })
    .returns<SubmitExamRpcRow[]>();

  if (error) {
    throw new Error(`Unable to submit exam answers: ${error.message}`);
  }

  const submission = Array.isArray(data) ? data[0] : undefined;
  if (!submission) {
    throw new Error('Exam submission failed. Please try again.');
  }

  const result = await fetchStudentExamResult(examId);

  // Return server-graded values with latest exam/course metadata.
  return {
    ...result,
    attemptId: submission.attempt_id,
    correctAnswers: toNumber(submission.correct_answers),
    remark: submission.remark || result.remark,
    scorePercent: toNumber(submission.score_percent),
    submittedAt: submission.submitted_at || result.submittedAt,
    totalQuestions: toNumber(submission.total_questions),
  };
}

export async function fetchStudentExamResult(examIdInput?: string): Promise<StudentExamResultData> {
  const examId = examIdInput?.trim();
  const profile = await getCurrentStudentProfile();

  let query = supabase
    .from('student_exam_results')
    .select(
      'attempt_id, exam_id, course_code, course_title, exam_title, score_percent, correct_answers, total_questions, remark, submitted_at'
    )
    .eq('student_id', profile.id)
    .eq('attempt_status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (examId) {
    query = query.eq('exam_id', examId);
  }

  const { data, error } = await query.returns<StudentExamResultRow[]>();

  if (error) {
    throw new Error(`Unable to load exam results: ${error.message}`);
  }

  const row = (data ?? [])[0];
  if (!row) {
    throw new Error('No submitted exam result was found yet.');
  }

  return {
    attemptId: row.attempt_id,
    correctAnswers: toNumber(row.correct_answers),
    courseCode: String(row.course_code ?? '').toUpperCase() || 'COURSE',
    courseTitle: row.course_title ?? row.exam_title,
    examId: row.exam_id,
    examTitle: row.exam_title || row.course_title || 'Exam Session',
    remark: row.remark || 'No remark available.',
    scorePercent: toNumber(row.score_percent),
    submittedAt: row.submitted_at,
    totalQuestions: Math.max(1, toNumber(row.total_questions)),
  };
}
