-- Foto do aparelho (revenda) no Storage; path em resale_devices.image_storage_path
alter table public.resale_devices
  add column if not exists image_storage_path text;

comment on column public.resale_devices.image_storage_path is 'Caminho no bucket resale-device-photos; se preenchido, tem precedência sobre image_url na exibição.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resale-device-photos',
  'resale-device-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resale_device_photos_staff_admin_all" on storage.objects;
create policy "resale_device_photos_staff_admin_all"
on storage.objects for all to authenticated
using (
  bucket_id = 'resale-device-photos' and public.is_staff_or_admin()
)
with check (
  bucket_id = 'resale-device-photos' and public.is_staff_or_admin()
);
