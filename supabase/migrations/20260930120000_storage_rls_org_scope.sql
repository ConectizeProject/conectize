-- Escopo de storage por organização: whatsapp-media, resale-device-photos e organization-logos.
-- Fotos de OS já usam join em service_orders.organization_id; estes buckets ficaram só com is_staff_or_admin().

-- ---------------------------------------------------------------------------
-- organization-logos: staff só no prefixo da org ativa (leitura pública permanece)
-- ---------------------------------------------------------------------------
drop policy if exists "organization_logos_staff_admin_all" on storage.objects;
create policy "organization_logos_staff_admin_all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'organization-logos'
  and public.is_staff_or_admin()
  and split_part(name, '/', 1) = public.current_organization_id()::text
)
with check (
  bucket_id = 'organization-logos'
  and public.is_staff_or_admin()
  and split_part(name, '/', 1) = public.current_organization_id()::text
);

-- ---------------------------------------------------------------------------
-- resale-device-photos: path {deviceId}/...
-- ---------------------------------------------------------------------------
drop policy if exists "resale_device_photos_staff_admin_all" on storage.objects;
create policy "resale_device_photos_staff_admin_all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'resale-device-photos'
  and public.is_staff_or_admin()
  and exists (
    select 1
    from public.resale_devices d
    where d.id::text = split_part(name, '/', 1)
      and d.organization_id = public.current_organization_id()
  )
)
with check (
  bucket_id = 'resale-device-photos'
  and public.is_staff_or_admin()
  and exists (
    select 1
    from public.resale_devices d
    where d.id::text = split_part(name, '/', 1)
      and d.organization_id = public.current_organization_id()
  )
);

drop policy if exists "resale_device_photos_retailer_select" on storage.objects;
create policy "resale_device_photos_retailer_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resale-device-photos'
  and public.is_retailer()
  and exists (
    select 1
    from public.resale_devices d
    join public.customer_portal_members m on m.user_id = auth.uid()
    join public.customers c on c.id = m.customer_id
    where d.id::text = split_part(name, '/', 1)
      and c.organization_id = d.organization_id
  )
);

-- ---------------------------------------------------------------------------
-- whatsapp-media: path gravado em whatsapp_messages.payload.media.storage_path
-- ---------------------------------------------------------------------------
drop policy if exists "whatsapp_media_staff_admin_all" on storage.objects;
create policy "whatsapp_media_staff_admin_all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'whatsapp-media'
  and public.is_staff_or_admin()
  and exists (
    select 1
    from public.whatsapp_messages m
    join public.whatsapp_conversations wc on wc.id = m.conversation_id
    where nullif(trim(m.payload #>> '{media,storage_path}'), '') = name
      and wc.organization_id = public.current_organization_id()
      and public.user_can_view_hub_connection_inbox(wc.hub_connection_id)
  )
)
with check (
  bucket_id = 'whatsapp-media'
  and public.is_staff_or_admin()
  and exists (
    select 1
    from public.whatsapp_messages m
    join public.whatsapp_conversations wc on wc.id = m.conversation_id
    where nullif(trim(m.payload #>> '{media,storage_path}'), '') = name
      and wc.organization_id = public.current_organization_id()
      and public.user_can_view_hub_connection_inbox(wc.hub_connection_id)
  )
);
