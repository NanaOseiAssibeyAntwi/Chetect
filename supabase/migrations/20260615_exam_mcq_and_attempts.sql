begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'exam_attempt_status'
  ) then
    create type public.exam_attempt_status as enum ('in_progress', 'submitted');
  end if;
end;
$$;

create table if not exists public.exam_questions (
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

create table if not exists public.exam_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  option_order integer not null check (option_order > 0),
  option_text text not null check (length(trim(option_text)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, option_order)
);

create table if not exists public.exam_question_answer_keys (
  question_id uuid primary key references public.exam_questions (id) on delete cascade,
  correct_option_id uuid not null references public.exam_question_options (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exam_attempts (
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

create table if not exists public.exam_attempt_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  selected_option_id uuid references public.exam_question_options (id) on delete set null,
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (attempt_id, question_id)
);

create index if not exists idx_exam_questions_exam
on public.exam_questions (exam_id, question_order);

create index if not exists idx_exam_question_options_question
on public.exam_question_options (question_id, option_order);

create index if not exists idx_exam_attempts_exam
on public.exam_attempts (exam_id, submitted_at desc);

create index if not exists idx_exam_attempts_student
on public.exam_attempts (student_id, submitted_at desc);

create index if not exists idx_exam_attempt_answers_question
on public.exam_attempt_answers (question_id);

create or replace function public.validate_answer_key_option()
returns trigger
language plpgsql
as $$
#variable_conflict use_column
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

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_exam_questions_updated_at'
      and tgrelid = 'public.exam_questions'::regclass
  ) then
    create trigger set_exam_questions_updated_at
    before update on public.exam_questions
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_exam_attempts_updated_at'
      and tgrelid = 'public.exam_attempts'::regclass
  ) then
    create trigger set_exam_attempts_updated_at
    before update on public.exam_attempts
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_exam_attempt_answers_updated_at'
      and tgrelid = 'public.exam_attempt_answers'::regclass
  ) then
    create trigger set_exam_attempt_answers_updated_at
    before update on public.exam_attempt_answers
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'validate_answer_key_option'
      and tgrelid = 'public.exam_question_answer_keys'::regclass
  ) then
    create trigger validate_answer_key_option
    before insert or update on public.exam_question_answer_keys
    for each row execute function public.validate_answer_key_option();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'validate_exam_attempt_answer'
      and tgrelid = 'public.exam_attempt_answers'::regclass
  ) then
    create trigger validate_exam_attempt_answer
    before insert or update on public.exam_attempt_answers
    for each row execute function public.validate_exam_attempt_answer();
  end if;
end;
$$;

alter table public.exam_questions enable row level security;
alter table public.exam_question_options enable row level security;
alter table public.exam_question_answer_keys enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_answers enable row level security;

drop policy if exists "exam_questions_select_relevant" on public.exam_questions;
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

drop policy if exists "exam_questions_manage_staff" on public.exam_questions;
create policy "exam_questions_manage_staff"
on public.exam_questions
for all
to authenticated
using (public.is_exam_invigilator(exam_id))
with check (public.is_exam_invigilator(exam_id));

drop policy if exists "exam_question_options_select_relevant" on public.exam_question_options;
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

drop policy if exists "exam_question_options_manage_staff" on public.exam_question_options;
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

drop policy if exists "exam_question_answer_keys_select_staff" on public.exam_question_answer_keys;
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

drop policy if exists "exam_question_answer_keys_manage_staff" on public.exam_question_answer_keys;
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

drop policy if exists "exam_attempts_select_relevant" on public.exam_attempts;
create policy "exam_attempts_select_relevant"
on public.exam_attempts
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_exam_invigilator(exam_id)
);

drop policy if exists "exam_attempts_manage_staff" on public.exam_attempts;
create policy "exam_attempts_manage_staff"
on public.exam_attempts
for all
to authenticated
using (public.is_exam_invigilator(exam_id))
with check (public.is_exam_invigilator(exam_id));

drop policy if exists "exam_attempt_answers_select_relevant" on public.exam_attempt_answers;
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

drop policy if exists "exam_attempt_answers_manage_staff" on public.exam_attempt_answers;
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
