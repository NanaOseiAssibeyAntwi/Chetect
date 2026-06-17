begin;

-- Bootstrap schema script.
-- Run this file once on a clean database only.
-- For updates on an existing database, use incremental files in `supabase/migrations/`.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('student', 'invigilator', 'admin');
create type public.exam_status as enum ('draft', 'scheduled', 'live', 'completed', 'cancelled');
create type public.monitoring_mode as enum ('standard', 'strict', 'minimal');
create type public.session_status as enum ('pending', 'active', 'paused', 'submitted', 'completed', 'terminated');
create type public.analysis_label as enum ('NO_FACE', 'NORMAL', 'CAUTION', 'SUSPICIOUS');
create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
create type public.review_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type public.review_decision as enum ('clear', 'warning', 'flagged', 'confirmed_cheating');
create type public.exam_attempt_status as enum ('in_progress', 'submitted');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_exam_scheduled_end()
returns trigger
language plpgsql
as $$
begin
  new.scheduled_end = new.scheduled_start + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext unique,
  full_name text not null,
  role public.app_role not null default 'student',
  institutional_id text unique,
  department_name text,
  avatar_url text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  department_name text,
  level text,
  term text,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  created_by uuid references public.profiles (id) on delete set null,
  academic_session text,
  scheduled_start timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  scheduled_end timestamptz not null,
  room_name text,
  instructions text,
  access_code text,
  max_students integer not null default 50 check (max_students > 0),
  monitoring_mode public.monitoring_mode not null default 'standard',
  status public.exam_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  question_order integer not null check (question_order > 0),
  prompt text not null check (length(trim(prompt)) > 0),
  created_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, question_order)
);

create table public.exam_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  option_order integer not null check (option_order > 0),
  option_text text not null check (length(trim(option_text)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, option_order)
);

create table public.exam_question_answer_keys (
  question_id uuid primary key references public.exam_questions (id) on delete cascade,
  correct_option_id uuid not null references public.exam_question_options (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.exam_attempt_status not null default 'in_progress',
  submitted_at timestamptz,
  total_questions integer not null default 0 check (total_questions >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  score_percent integer not null default 0 check (score_percent between 0 and 100),
  remark text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, student_id),
  check (
    (status = 'submitted' and submitted_at is not null)
    or (status = 'in_progress' and submitted_at is null)
  )
);

create table public.exam_attempt_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  selected_option_id uuid references public.exam_question_options (id) on delete set null,
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (attempt_id, question_id)
);

create table public.exam_invigilators (
  exam_id uuid not null references public.exams (id) on delete cascade,
  invigilator_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (exam_id, invigilator_id)
);

create table public.exam_registrations (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  candidate_number text,
  seat_number text,
  registration_status text not null default 'registered' check (
    registration_status in ('registered', 'checked_in', 'active', 'submitted', 'completed', 'absent', 'cancelled')
  ),
  registered_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (exam_id, student_id)
);

create table public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  backend_session_id text unique,
  exam_id uuid not null references public.exams (id) on delete cascade,
  registration_id uuid references public.exam_registrations (id) on delete set null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.session_status not null default 'pending',
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  source text not null default 'mobile',
  device_info jsonb not null default '{}'::jsonb,
  analysis_config jsonb not null default '{}'::jsonb,
  frames_processed integer not null default 0 check (frames_processed >= 0),
  frames_sampled integer not null default 0 check (frames_sampled >= 0),
  detections integer not null default 0 check (detections >= 0),
  max_score integer not null default 0 check (max_score between 0 and 100),
  average_score numeric(6, 2) not null default 0 check (average_score >= 0),
  final_label public.analysis_label not null default 'NO_FACE',
  suspicious_event_count integer not null default 0 check (suspicious_event_count >= 0),
  latest_observation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_at is null or ended_at >= started_at)
);

create unique index analysis_sessions_active_exam_student_idx
on public.analysis_sessions (exam_id, student_id)
where status in ('pending', 'active', 'paused');

create table public.analysis_frames (
  id bigint generated always as identity primary key,
  analysis_session_id uuid not null references public.analysis_sessions (id) on delete cascade,
  frame_index integer not null check (frame_index >= 0),
  timestamp_seconds numeric(10, 2) not null default 0 check (timestamp_seconds >= 0),
  detected boolean not null default false,
  face_count integer not null default 0 check (face_count >= 0),
  score integer check (score between 0 and 100),
  label public.analysis_label not null default 'NO_FACE',
  label_color jsonb not null default '[]'::jsonb,
  observations jsonb not null default '[]'::jsonb,
  gaze_x numeric(8, 4),
  gaze_y numeric(8, 4),
  blink_rate numeric(8, 4),
  head_yaw numeric(8, 4),
  head_pitch numeric(8, 4),
  head_roll numeric(8, 4),
  ear numeric(8, 4),
  landmarks jsonb,
  captured_at timestamptz not null default timezone('utc', now()),
  unique (analysis_session_id, frame_index)
);

create table public.suspicious_events (
  id uuid primary key default gen_random_uuid(),
  analysis_session_id uuid not null references public.analysis_sessions (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  label public.analysis_label not null,
  reason text not null,
  risk_level public.risk_level not null default 'medium',
  source text not null default 'ai',
  start_timestamp_seconds numeric(10, 2) not null default 0 check (start_timestamp_seconds >= 0),
  end_timestamp_seconds numeric(10, 2) not null default 0 check (end_timestamp_seconds >= start_timestamp_seconds),
  start_frame_index integer not null default 0 check (start_frame_index >= 0),
  end_frame_index integer not null default 0 check (end_frame_index >= start_frame_index),
  frame_count integer not null default 1 check (frame_count > 0),
  max_score integer check (max_score between 0 and 100),
  evidence jsonb not null default '{}'::jsonb,
  review_status public.review_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.session_reviews (
  id uuid primary key default gen_random_uuid(),
  analysis_session_id uuid not null unique references public.analysis_sessions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  integrity_score numeric(5, 2) not null check (integrity_score between 0 and 100),
  final_decision public.review_decision not null,
  summary text,
  action_notes text,
  reviewed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  notification_type text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_profiles_role on public.profiles (role);
create index idx_courses_department on public.courses (department_name);
create index idx_exams_course_status on public.exams (course_id, status, scheduled_start desc);
create index idx_exam_questions_exam on public.exam_questions (exam_id, question_order);
create index idx_exam_question_options_question on public.exam_question_options (question_id, option_order);
create index idx_exam_attempts_exam on public.exam_attempts (exam_id, submitted_at desc);
create index idx_exam_attempts_student on public.exam_attempts (student_id, submitted_at desc);
create index idx_exam_attempt_answers_question on public.exam_attempt_answers (question_id);
create index idx_exam_registrations_student on public.exam_registrations (student_id, exam_id);
create index idx_analysis_sessions_exam on public.analysis_sessions (exam_id, status, started_at desc);
create index idx_analysis_sessions_student on public.analysis_sessions (student_id, started_at desc);
create index idx_analysis_frames_session on public.analysis_frames (analysis_session_id, frame_index);
create index idx_suspicious_events_session on public.suspicious_events (analysis_session_id, created_at desc);
create index idx_suspicious_events_exam on public.suspicious_events (exam_id, review_status, risk_level);
create index idx_notifications_user on public.notifications (user_id, created_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.is_invigilator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('invigilator', 'admin'), false)
$$;

create or replace function public.is_exam_invigilator(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_invigilators ei
    where ei.exam_id = target_exam_id
      and ei.invigilator_id = auth.uid()
  )
  or exists (
    select 1
    from public.exams e
    where e.id = target_exam_id
      and e.created_by = auth.uid()
  )
  or public.is_admin()
$$;

create or replace function public.validate_answer_key_option()
returns trigger
language plpgsql
as $$
declare
  option_question_id uuid;
begin
  select question_id
  into option_question_id
  from public.exam_question_options
  where id = new.correct_option_id;

  if option_question_id is null then
    raise exception 'The answer key references an option that does not exist.';
  end if;

  if option_question_id <> new.question_id then
    raise exception 'The answer key option must belong to the same question.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_exam_attempt_answer()
returns trigger
language plpgsql
as $$
declare
  attempt_exam_id uuid;
  question_exam_id uuid;
  option_question_id uuid;
begin
  select exam_id
  into attempt_exam_id
  from public.exam_attempts
  where id = new.attempt_id;

  if attempt_exam_id is null then
    raise exception 'The exam attempt does not exist.';
  end if;

  select exam_id
  into question_exam_id
  from public.exam_questions
  where id = new.question_id;

  if question_exam_id is null then
    raise exception 'The exam question does not exist.';
  end if;

  if question_exam_id <> attempt_exam_id then
    raise exception 'The selected question does not belong to this exam attempt.';
  end if;

  if new.selected_option_id is not null then
    select question_id
    into option_question_id
    from public.exam_question_options
    where id = new.selected_option_id;

    if option_question_id is null then
      raise exception 'The selected answer option does not exist.';
    end if;

    if option_question_id <> new.question_id then
      raise exception 'The selected answer option must belong to the same question.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.submit_exam_attempt(target_exam_id uuid, submitted_answers jsonb)
returns table (
  attempt_id uuid,
  exam_id uuid,
  total_questions integer,
  correct_answers integer,
  score_percent integer,
  remark text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  existing_attempt_id uuid;
  existing_attempt_status public.exam_attempt_status;
  existing_attempt_total integer;
  existing_attempt_correct integer;
  existing_attempt_score integer;
  existing_attempt_remark text;
  existing_attempt_submitted_at timestamptz;
  questions_total integer;
  questions_correct integer;
  calculated_score integer;
  calculated_remark text;
  saved_attempt_id uuid;
  saved_submitted_at timestamptz;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'You must be signed in to submit this exam.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.role = 'student'
  ) then
    raise exception 'Only student accounts can submit exam answers.';
  end if;

  if not exists (
    select 1
    from public.exam_registrations er
    where er.exam_id = target_exam_id
      and er.student_id = current_user_id
      and er.registration_status <> 'cancelled'
  ) then
    raise exception 'You are not registered for this exam session.';
  end if;

  select
    a.id,
    a.status,
    a.total_questions,
    a.correct_answers,
    a.score_percent,
    a.remark,
    a.submitted_at
  into
    existing_attempt_id,
    existing_attempt_status,
    existing_attempt_total,
    existing_attempt_correct,
    existing_attempt_score,
    existing_attempt_remark,
    existing_attempt_submitted_at
  from public.exam_attempts a
  where a.exam_id = target_exam_id
    and a.student_id = current_user_id;

  if existing_attempt_id is not null and existing_attempt_status = 'submitted' then
    return query
    select
      existing_attempt_id,
      target_exam_id,
      coalesce(existing_attempt_total, 0),
      coalesce(existing_attempt_correct, 0),
      coalesce(existing_attempt_score, 0),
      coalesce(existing_attempt_remark, ''),
      existing_attempt_submitted_at;
    return;
  end if;

  if submitted_answers is null or jsonb_typeof(submitted_answers) <> 'array' then
    raise exception 'Submitted answers must be a JSON array.';
  end if;

  select count(*)
  into questions_total
  from public.exam_questions q
  where q.exam_id = target_exam_id;

  if questions_total = 0 then
    raise exception 'This exam has no questions yet.';
  end if;

  with parsed_answers as (
    select
      nullif(trim(item ->> 'questionId'), '')::uuid as question_id,
      case
        when coalesce(item ? 'selectedOptionId', false)
          and nullif(trim(item ->> 'selectedOptionId'), '') is not null
        then (item ->> 'selectedOptionId')::uuid
        else null
      end as selected_option_id
    from jsonb_array_elements(submitted_answers) as item
  ),
  normalized_answers as (
    select distinct on (question_id)
      question_id,
      selected_option_id
    from parsed_answers
    where question_id is not null
    order by question_id
  )
  select coalesce(sum(case when normalized_answers.selected_option_id = ak.correct_option_id then 1 else 0 end), 0)
  into questions_correct
  from public.exam_questions q
  join public.exam_question_answer_keys ak on ak.question_id = q.id
  left join normalized_answers on normalized_answers.question_id = q.id
  where q.exam_id = target_exam_id;

  calculated_score := round((questions_correct::numeric / questions_total::numeric) * 100)::integer;

  calculated_remark := case
    when calculated_score >= 85 then 'Excellent performance.'
    when calculated_score >= 70 then 'Great work.'
    when calculated_score >= 50 then 'Fair attempt. Keep practicing.'
    else 'Needs improvement. Review the course and try again.'
  end;

  if existing_attempt_id is null then
    insert into public.exam_attempts as ea (
      exam_id,
      student_id,
      status,
      submitted_at,
      total_questions,
      correct_answers,
      score_percent,
      remark
    )
    values (
      target_exam_id,
      current_user_id,
      'submitted',
      timezone('utc', now()),
      questions_total,
      questions_correct,
      calculated_score,
      calculated_remark
    )
    returning ea.id, ea.submitted_at
    into saved_attempt_id, saved_submitted_at;
  else
    update public.exam_attempts as ea
    set
      status = 'submitted',
      submitted_at = timezone('utc', now()),
      total_questions = questions_total,
      correct_answers = questions_correct,
      score_percent = calculated_score,
      remark = calculated_remark
    where id = existing_attempt_id
    returning ea.id, ea.submitted_at
    into saved_attempt_id, saved_submitted_at;

    delete from public.exam_attempt_answers
    where attempt_id = saved_attempt_id;
  end if;

  with parsed_answers as (
    select
      nullif(trim(item ->> 'questionId'), '')::uuid as question_id,
      case
        when coalesce(item ? 'selectedOptionId', false)
          and nullif(trim(item ->> 'selectedOptionId'), '') is not null
        then (item ->> 'selectedOptionId')::uuid
        else null
      end as selected_option_id
    from jsonb_array_elements(submitted_answers) as item
  ),
  normalized_answers as (
    select distinct on (question_id)
      question_id,
      selected_option_id
    from parsed_answers
    where question_id is not null
    order by question_id
  )
  insert into public.exam_attempt_answers (
    attempt_id,
    question_id,
    selected_option_id,
    is_correct
  )
  select
    saved_attempt_id,
    q.id,
    normalized_answers.selected_option_id,
    coalesce(normalized_answers.selected_option_id = ak.correct_option_id, false)
  from public.exam_questions q
  join public.exam_question_answer_keys ak on ak.question_id = q.id
  left join normalized_answers on normalized_answers.question_id = q.id
  where q.exam_id = target_exam_id;

  update public.exam_registrations
  set
    registration_status = 'submitted',
    submitted_at = timezone('utc', now())
  where exam_id = target_exam_id
    and student_id = current_user_id;

  return query
  select
    saved_attempt_id,
    target_exam_id,
    questions_total,
    questions_correct,
    calculated_score,
    calculated_remark,
    saved_submitted_at;
end;
$$;

grant execute on function public.submit_exam_attempt(uuid, jsonb) to authenticated;

create or replace function public.sync_exam_lifecycle_statuses()
returns table (
  exams_marked_live integer,
  exams_marked_completed integer,
  sessions_marked_terminal integer,
  registrations_marked_terminal integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
begin
  update public.exams
  set status = 'live'
  where status = 'scheduled'
    and scheduled_start <= now_utc
    and scheduled_end > now_utc;
  get diagnostics exams_marked_live = row_count;

  update public.exams
  set status = 'completed'
  where status in ('scheduled', 'live')
    and scheduled_end <= now_utc;
  get diagnostics exams_marked_completed = row_count;

  update public.analysis_sessions as s
  set
    status = case
      when s.status = 'pending' then 'terminated'::public.session_status
      else 'completed'::public.session_status
    end,
    ended_at = coalesce(s.ended_at, now_utc)
  from public.exams e
  where e.id = s.exam_id
    and e.status = 'completed'
    and s.status in ('pending', 'active', 'paused');
  get diagnostics sessions_marked_terminal = row_count;

  update public.exam_registrations as er
  set
    registration_status = case
      when exists (
        select 1
        from public.exam_attempts a
        where a.exam_id = er.exam_id
          and a.student_id = er.student_id
          and a.status = 'submitted'
      ) then 'submitted'
      when er.registration_status in ('registered', 'checked_in', 'active') then 'completed'
      else er.registration_status
    end,
    submitted_at = case
      when exists (
        select 1
        from public.exam_attempts a
        where a.exam_id = er.exam_id
          and a.student_id = er.student_id
          and a.status = 'submitted'
      ) and er.submitted_at is null
      then now_utc
      else er.submitted_at
    end
  from public.exams e
  where e.id = er.exam_id
    and e.status = 'completed'
    and er.registration_status in ('registered', 'checked_in', 'active', 'submitted');
  get diagnostics registrations_marked_terminal = row_count;

  return query
  select
    exams_marked_live,
    exams_marked_completed,
    sessions_marked_terminal,
    registrations_marked_terminal;
end;
$$;

grant execute on function public.sync_exam_lifecycle_statuses() to authenticated;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger set_exams_updated_at
before update on public.exams
for each row execute function public.set_updated_at();

create trigger set_exams_scheduled_end
before insert or update of scheduled_start, duration_minutes on public.exams
for each row execute function public.set_exam_scheduled_end();

create trigger set_exam_questions_updated_at
before update on public.exam_questions
for each row execute function public.set_updated_at();

create trigger set_exam_attempts_updated_at
before update on public.exam_attempts
for each row execute function public.set_updated_at();

create trigger set_exam_attempt_answers_updated_at
before update on public.exam_attempt_answers
for each row execute function public.set_updated_at();

create trigger validate_answer_key_option
before insert or update on public.exam_question_answer_keys
for each row execute function public.validate_answer_key_option();

create trigger validate_exam_attempt_answer
before insert or update on public.exam_attempt_answers
for each row execute function public.validate_exam_attempt_answer();

create trigger set_analysis_sessions_updated_at
before update on public.analysis_sessions
for each row execute function public.set_updated_at();

create trigger set_session_reviews_updated_at
before update on public.session_reviews
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    institutional_id,
    department_name,
    avatar_url,
    metadata
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case
      when requested_role in ('student', 'invigilator', 'admin') then requested_role::public.app_role
      else 'student'::public.app_role
    end,
    new.raw_user_meta_data ->> 'institutional_id',
    new.raw_user_meta_data ->> 'department_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_question_options enable row level security;
alter table public.exam_question_answer_keys enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_answers enable row level security;
alter table public.exam_invigilators enable row level security;
alter table public.exam_registrations enable row level security;
alter table public.analysis_sessions enable row level security;
alter table public.analysis_frames enable row level security;
alter table public.suspicious_events enable row level security;
alter table public.session_reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_staff"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_invigilator());

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "courses_read_authenticated"
on public.courses
for select
to authenticated
using (true);

create policy "courses_manage_staff"
on public.courses
for all
to authenticated
using (public.is_invigilator())
with check (public.is_invigilator());

create policy "exams_select_relevant"
on public.exams
for select
to authenticated
using (
  public.is_invigilator()
  or exists (
    select 1
    from public.exam_registrations er
    where er.exam_id = exams.id
      and er.student_id = auth.uid()
  )
);

create policy "exams_manage_staff"
on public.exams
for all
to authenticated
using (public.is_invigilator())
with check (public.is_invigilator());

create policy "exam_questions_select_relevant"
on public.exam_questions
for select
to authenticated
using (
  public.is_exam_invigilator(exam_id)
  or exists (
    select 1
    from public.exam_registrations er
    where er.exam_id = exam_questions.exam_id
      and er.student_id = auth.uid()
  )
);

create policy "exam_questions_manage_staff"
on public.exam_questions
for all
to authenticated
using (public.is_exam_invigilator(exam_id))
with check (public.is_exam_invigilator(exam_id));

create policy "exam_question_options_select_relevant"
on public.exam_question_options
for select
to authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_options.question_id
      and (
        public.is_exam_invigilator(q.exam_id)
        or exists (
          select 1
          from public.exam_registrations er
          where er.exam_id = q.exam_id
            and er.student_id = auth.uid()
        )
      )
  )
);

create policy "exam_question_options_manage_staff"
on public.exam_question_options
for all
to authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_options.question_id
      and public.is_exam_invigilator(q.exam_id)
  )
)
with check (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_options.question_id
      and public.is_exam_invigilator(q.exam_id)
  )
);

create policy "exam_question_answer_keys_select_staff"
on public.exam_question_answer_keys
for select
to authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_answer_keys.question_id
      and public.is_exam_invigilator(q.exam_id)
  )
);

create policy "exam_question_answer_keys_manage_staff"
on public.exam_question_answer_keys
for all
to authenticated
using (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_answer_keys.question_id
      and public.is_exam_invigilator(q.exam_id)
  )
)
with check (
  exists (
    select 1
    from public.exam_questions q
    where q.id = exam_question_answer_keys.question_id
      and public.is_exam_invigilator(q.exam_id)
  )
);

create policy "exam_attempts_select_relevant"
on public.exam_attempts
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "exam_attempts_manage_staff"
on public.exam_attempts
for all
to authenticated
using (public.is_exam_invigilator(exam_id))
with check (public.is_exam_invigilator(exam_id));

create policy "exam_attempt_answers_select_relevant"
on public.exam_attempt_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.exam_attempts a
    where a.id = exam_attempt_answers.attempt_id
      and (
        a.student_id = auth.uid()
        or public.is_exam_invigilator(a.exam_id)
      )
  )
);

create policy "exam_attempt_answers_manage_staff"
on public.exam_attempt_answers
for all
to authenticated
using (
  exists (
    select 1
    from public.exam_attempts a
    where a.id = exam_attempt_answers.attempt_id
      and public.is_exam_invigilator(a.exam_id)
  )
)
with check (
  exists (
    select 1
    from public.exam_attempts a
    where a.id = exam_attempt_answers.attempt_id
      and public.is_exam_invigilator(a.exam_id)
  )
);

create policy "exam_invigilators_select_relevant"
on public.exam_invigilators
for select
to authenticated
using (
  invigilator_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
  or exists (
    select 1
    from public.exam_registrations er
    where er.exam_id = exam_invigilators.exam_id
      and er.student_id = auth.uid()
  )
);

create policy "exam_invigilators_manage_staff"
on public.exam_invigilators
for all
to authenticated
using (public.is_invigilator())
with check (public.is_invigilator());

create policy "exam_registrations_select_relevant"
on public.exam_registrations
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "exam_registrations_manage_staff"
on public.exam_registrations
for all
to authenticated
using (public.is_invigilator())
with check (public.is_invigilator());

create policy "analysis_sessions_select_relevant"
on public.analysis_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "analysis_sessions_insert_student_or_staff"
on public.analysis_sessions
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "analysis_sessions_update_student_or_staff"
on public.analysis_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
)
with check (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "analysis_frames_select_relevant"
on public.analysis_frames
for select
to authenticated
using (
  exists (
    select 1
    from public.analysis_sessions s
    where s.id = analysis_frames.analysis_session_id
      and (s.student_id = auth.uid() or public.is_exam_invigilator(s.exam_id))
  )
);

create policy "analysis_frames_insert_relevant"
on public.analysis_frames
for insert
to authenticated
with check (
  exists (
    select 1
    from public.analysis_sessions s
    where s.id = analysis_frames.analysis_session_id
      and (s.student_id = auth.uid() or public.is_exam_invigilator(s.exam_id))
  )
);

create policy "suspicious_events_select_relevant"
on public.suspicious_events
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "suspicious_events_insert_relevant"
on public.suspicious_events
for insert
to authenticated
with check (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

create policy "suspicious_events_update_staff"
on public.suspicious_events
for update
to authenticated
using (public.is_exam_invigilator(exam_id))
with check (public.is_exam_invigilator(exam_id));

create policy "session_reviews_select_relevant"
on public.session_reviews
for select
to authenticated
using (
  reviewer_id = auth.uid()
  or exists (
    select 1
    from public.analysis_sessions s
    where s.id = session_reviews.analysis_session_id
      and (s.student_id = auth.uid() or public.is_exam_invigilator(s.exam_id))
  )
);

create policy "session_reviews_manage_staff"
on public.session_reviews
for all
to authenticated
using (
  exists (
    select 1
    from public.analysis_sessions s
    where s.id = session_reviews.analysis_session_id
      and public.is_exam_invigilator(s.exam_id)
  )
)
with check (
  exists (
    select 1
    from public.analysis_sessions s
    where s.id = session_reviews.analysis_session_id
      and public.is_exam_invigilator(s.exam_id)
  )
);

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications_manage_staff"
on public.notifications
for all
to authenticated
using (public.is_invigilator())
with check (public.is_invigilator());

create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.is_admin());

create policy "audit_logs_insert_staff"
on public.audit_logs
for insert
to authenticated
with check (public.is_invigilator());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('suspiciousVideos', 'suspiciousVideos', true, 52428800, array['video/mp4'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "suspiciousVideos_public_read" on storage.objects;
create policy "suspiciousVideos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'suspiciousVideos');

drop policy if exists "suspiciousVideos_authenticated_upload" on storage.objects;
create policy "suspiciousVideos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'suspiciousVideos'
  and (
    public.is_invigilator()
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);

drop policy if exists "suspiciousVideos_owner_update" on storage.objects;
create policy "suspiciousVideos_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'suspiciousVideos'
  and (
    public.is_invigilator()
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
)
with check (
  bucket_id = 'suspiciousVideos'
  and (
    public.is_invigilator()
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);

drop policy if exists "suspiciousVideos_owner_delete" on storage.objects;
create policy "suspiciousVideos_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'suspiciousVideos'
  and (
    public.is_invigilator()
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);

create or replace view public.session_report_view as
select
  s.id as analysis_session_id,
  s.backend_session_id,
  s.exam_id,
  e.title as exam_title,
  e.status as exam_status,
  e.scheduled_start,
  c.code as course_code,
  c.title as course_title,
  s.student_id,
  p.full_name as student_name,
  p.institutional_id as student_number,
  s.status as session_status,
  s.started_at,
  s.ended_at,
  s.frames_sampled,
  s.detections,
  s.max_score,
  s.average_score,
  s.final_label,
  s.suspicious_event_count,
  greatest(0, 100 - s.max_score) as calculated_integrity_score,
  sr.integrity_score as reviewed_integrity_score,
  sr.final_decision,
  sr.reviewed_at
from public.analysis_sessions s
join public.exams e on e.id = s.exam_id
join public.courses c on c.id = e.course_id
join public.profiles p on p.id = s.student_id
left join public.session_reviews sr on sr.analysis_session_id = s.id;

create or replace view public.invigilator_live_overview as
select
  e.id as exam_id,
  c.code as course_code,
  c.title as course_title,
  e.title as exam_title,
  e.status,
  e.monitoring_mode,
  e.scheduled_start,
  count(distinct er.student_id) as registered_students,
  count(distinct s.id) filter (where s.status in ('pending', 'active', 'paused')) as live_sessions,
  count(distinct s.id) filter (where s.max_score >= 75 or s.suspicious_event_count > 0) as flagged_sessions,
  coalesce(max(s.max_score), 0) as highest_score
from public.exams e
join public.courses c on c.id = e.course_id
left join public.exam_registrations er on er.exam_id = e.id
left join public.analysis_sessions s on s.exam_id = e.id
group by e.id, c.code, c.title, e.title, e.status, e.monitoring_mode, e.scheduled_start;

create or replace view public.student_exam_schedule as
select
  er.student_id,
  e.id as exam_id,
  c.code as course_code,
  c.title as course_title,
  e.title as exam_title,
  e.scheduled_start,
  e.scheduled_end,
  e.room_name,
  e.status,
  e.monitoring_mode,
  er.registration_status,
  s.id as latest_session_id,
  s.status as latest_session_status,
  s.final_label as latest_final_label,
  s.max_score as latest_max_score
from public.exam_registrations er
join public.exams e on e.id = er.exam_id
join public.courses c on c.id = e.course_id
left join lateral (
  select s1.*
  from public.analysis_sessions s1
  where s1.exam_id = e.id
    and s1.student_id = er.student_id
  order by s1.started_at desc
  limit 1
) s on true;

create or replace view public.student_exam_results as
select
  a.id as attempt_id,
  a.exam_id,
  a.student_id,
  a.status as attempt_status,
  a.submitted_at,
  a.total_questions,
  a.correct_answers,
  a.score_percent,
  a.remark,
  e.title as exam_title,
  e.status as exam_status,
  e.scheduled_start,
  e.scheduled_end,
  c.code as course_code,
  c.title as course_title
from public.exam_attempts a
join public.exams e on e.id = a.exam_id
join public.courses c on c.id = e.course_id;

commit;
