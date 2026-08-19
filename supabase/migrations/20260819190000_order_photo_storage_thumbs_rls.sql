-- Fotos da OS: o preview usa `{stem}.thumb.jpg` ao lado do arquivo original.
-- As policies de entrada/saída só liberavam o `storage_path` gravado na tabela,
-- então assinar o thumb (e, em lote, a foto original) falhava no RLS.

drop policy if exists order_entry_photos_staff_admin_all on storage.objects;
create policy order_entry_photos_staff_admin_all
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'order-entry-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  )
  with check (
    bucket_id = 'order-entry-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  );

drop policy if exists order_exit_photos_staff_admin_all on storage.objects;
create policy order_exit_photos_staff_admin_all
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'order-exit-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  )
  with check (
    bucket_id = 'order-exit-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  );
