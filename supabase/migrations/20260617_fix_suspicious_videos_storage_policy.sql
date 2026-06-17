begin;

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

commit;
