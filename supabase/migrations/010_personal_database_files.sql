-- Неделька: приватные файлы личных баз

insert into storage.buckets (id, name, public, file_size_limit)
values ('personal-files', 'personal-files', false, 10485760)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

create policy "Users upload own personal database files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own personal database files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own personal database files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
