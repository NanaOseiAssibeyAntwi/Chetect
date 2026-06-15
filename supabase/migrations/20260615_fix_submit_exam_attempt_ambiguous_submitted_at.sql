begin;

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
#variable_conflict use_column
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

commit;
