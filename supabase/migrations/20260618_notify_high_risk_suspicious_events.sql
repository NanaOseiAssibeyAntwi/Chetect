create or replace function public.notify_high_risk_suspicious_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_title text;
  event_body text;
  exam_title text;
  course_code text;
  student_identifier text;
  student_name text;
begin
  if new.risk_level not in ('high'::public.risk_level, 'critical'::public.risk_level) then
    return new;
  end if;

  select
    e.title,
    c.code
  into exam_title, course_code
  from public.exams e
  left join public.courses c on c.id = e.course_id
  where e.id = new.exam_id;

  select
    p.full_name,
    p.institutional_id
  into student_name, student_identifier
  from public.profiles p
  where p.id = new.student_id;

  event_title := case
    when new.risk_level = 'critical'::public.risk_level then 'Critical suspicious activity'
    else 'High-risk suspicious activity'
  end;

  event_body := concat(
    coalesce(nullif(trim(student_name), ''), 'A student'),
    case
      when nullif(trim(student_identifier), '') is null then ''
      else concat(' (', upper(student_identifier), ')')
    end,
    ' was flagged in ',
    coalesce(nullif(trim(course_code), ''), nullif(trim(exam_title), ''), 'an exam session'),
    ': ',
    coalesce(nullif(trim(new.reason), ''), 'Suspicious behavior detected.')
  );

  with recipients as (
    select e.created_by as user_id
    from public.exams e
    where e.id = new.exam_id
      and e.created_by is not null

    union

    select ei.invigilator_id as user_id
    from public.exam_invigilators ei
    where ei.exam_id = new.exam_id

    union

    select p.id as user_id
    from public.profiles p
    where p.role = 'admin'::public.app_role
  )
  insert into public.notifications (
    user_id,
    title,
    body,
    notification_type,
    data
  )
  select distinct
    recipients.user_id,
    event_title,
    event_body,
    'suspicious_event_high_risk',
    jsonb_build_object(
      'examId', new.exam_id,
      'suspiciousEventId', new.id,
      'analysisSessionId', new.analysis_session_id,
      'studentId', new.student_id,
      'riskLevel', new.risk_level,
      'label', new.label,
      'maxScore', new.max_score,
      'courseCode', course_code,
      'examTitle', exam_title
    )
  from recipients
  where recipients.user_id is not null;

  return new;
end;
$$;

drop trigger if exists notify_high_risk_suspicious_event on public.suspicious_events;
create trigger notify_high_risk_suspicious_event
after insert on public.suspicious_events
for each row execute function public.notify_high_risk_suspicious_event();
