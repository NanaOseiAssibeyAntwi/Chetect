begin;

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

commit;
