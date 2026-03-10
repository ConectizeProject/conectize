-- Fotos do aparelho no momento de entrada (por OS)
-- Storage: bucket order-entry-photos, path {service_order_id}/{uuid}.{ext}

create table if not exists public.service_order_entry_photos (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists service_order_entry_photos_order_id_idx
  on public.service_order_entry_photos(service_order_id);

alter table public.service_order_entry_photos enable row level security;

-- Staff/admin podem ver fotos de qualquer OS (mesma regra de service_orders)
create policy "service_order_entry_photos_staff_admin_select"
on public.service_order_entry_photos for select to authenticated
using (public.is_staff_or_admin());

create policy "service_order_entry_photos_staff_admin_insert"
on public.service_order_entry_photos for insert to authenticated
with check (public.is_staff_or_admin());

create policy "service_order_entry_photos_staff_admin_delete"
on public.service_order_entry_photos for delete to authenticated
using (public.is_staff_or_admin());

-- Bucket no Storage (fotos privadas; URLs assinadas para exibição)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-entry-photos',
  'order-entry-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS em storage.objects: staff/admin podem ler/inserir/deletar em order-entry-photos
drop policy if exists "order_entry_photos_staff_admin_all" on storage.objects;
create policy "order_entry_photos_staff_admin_all"
on storage.objects for all to authenticated
using (
  bucket_id = 'order-entry-photos' and public.is_staff_or_admin()
)
with check (
  bucket_id = 'order-entry-photos' and public.is_staff_or_admin()
);
