-- Mídia WhatsApp (Evolution): bucket privado, retenção ~24h via job de limpeza no app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "whatsapp_media_staff_admin_all" on storage.objects;
create policy "whatsapp_media_staff_admin_all"
on storage.objects for all to authenticated
using (
  bucket_id = 'whatsapp-media' and public.is_staff_or_admin()
)
with check (
  bucket_id = 'whatsapp-media' and public.is_staff_or_admin()
);

-- Service role (webhook + cron) precisa remover objetos expirados
drop policy if exists "whatsapp_media_service_role_delete" on storage.objects;
create policy "whatsapp_media_service_role_delete"
on storage.objects for delete to service_role
using (bucket_id = 'whatsapp-media');

drop policy if exists "whatsapp_media_service_role_insert" on storage.objects;
create policy "whatsapp_media_service_role_insert"
on storage.objects for insert to service_role
with check (bucket_id = 'whatsapp-media');

create index if not exists whatsapp_messages_media_expires_idx
  on public.whatsapp_messages ((payload #>> '{media,media_expires_at}'))
  where (payload #>> '{media,storage_path}') is not null;
