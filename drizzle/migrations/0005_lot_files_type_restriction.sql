drop policy if exists "lot-files role upload" on storage.objects;
create policy "lot-files role upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'lot-files'
    and public.has_org_role(public._org_from_path(name), '{administrador,encargado_beneficio,comercial,productor}')
    and lower(regexp_replace(name, '^.*\.', '')) in ('jpg','jpeg','png','webp','pdf'));