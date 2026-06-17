begin;

alter table if exists public.suspicious_events
  add column if not exists evidence jsonb not null default '{}'::jsonb;

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
  and (owner is null or owner::text = auth.uid()::text)
);

drop policy if exists "suspiciousVideos_owner_update" on storage.objects;
create policy "suspiciousVideos_owner_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'suspiciousVideos' and owner::text = auth.uid()::text)
with check (bucket_id = 'suspiciousVideos' and owner::text = auth.uid()::text);

drop policy if exists "suspiciousVideos_owner_delete" on storage.objects;
create policy "suspiciousVideos_owner_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'suspiciousVideos' and owner::text = auth.uid()::text);

commit;
