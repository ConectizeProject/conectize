-- Logos de organizações (público): usados em OS pública, cupom e impressão.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (bucket já é public; policy reforça SELECT para anon/authenticated)
drop policy if exists "organization_logos_public_read" on storage.objects;
create policy "organization_logos_public_read"
on storage.objects for select
to public
using (bucket_id = 'organization-logos');

-- Uploads via service role (cadastro público + admin da empresa no portal)
drop policy if exists "organization_logos_service_role_all" on storage.objects;
create policy "organization_logos_service_role_all"
on storage.objects for all
to service_role
using (bucket_id = 'organization-logos')
with check (bucket_id = 'organization-logos');

-- Admin/staff autenticado pode gerenciar logos no portal
drop policy if exists "organization_logos_staff_admin_all" on storage.objects;
create policy "organization_logos_staff_admin_all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'organization-logos' and public.is_staff_or_admin()
)
with check (
  bucket_id = 'organization-logos' and public.is_staff_or_admin()
);
