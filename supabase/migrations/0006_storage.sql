-- 0006_storage.sql
-- Private `documents` bucket. Files are stored as <household_id>/<entity>/<uuid>-<name>
-- so the first path segment is the authorization key.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'documents'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  );
