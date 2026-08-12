-- Fotos da assistência (visíveis ao cliente no link público da OS)

create table if not exists public.service_order_assistance_photos (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id)
);

create index if not exists service_order_assistance_photos_order_id_idx
  on public.service_order_assistance_photos(service_order_id);

create index if not exists service_order_assistance_photos_org_id_idx
  on public.service_order_assistance_photos(organization_id);

alter table public.service_order_assistance_photos enable row level security;

drop policy if exists service_order_assistance_photos_staff_admin_all on public.service_order_assistance_photos;
create policy service_order_assistance_photos_staff_admin_all
  on public.service_order_assistance_photos for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_assistance_photos.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and service_order_assistance_photos.organization_id = public.current_organization_id()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-assistance-photos',
  'order-assistance-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists order_assistance_photos_staff_admin_all on storage.objects;
create policy order_assistance_photos_staff_admin_all
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'order-assistance-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  )
  with check (
    bucket_id = 'order-assistance-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  );

-- Atualiza resumo de storage do admin para incluir fotos da assistência
create or replace function public.admin_storage_usage_summary(p_organization_id uuid)
returns jsonb
language sql
security definer
set search_path = public, storage
as $$
  with storage_sizes as (
    select
      o.bucket_id,
      o.name,
      case
        when (o.metadata->>'size') ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
        else 0
      end as size_bytes
    from storage.objects o
  ),
  project_buckets as (
    select
      s.bucket_id,
      count(*)::integer as file_count,
      coalesce(sum(s.size_bytes), 0)::bigint as bytes
    from storage_sizes s
    group by s.bucket_id
  ),
  category_paths as (
    select
      'os_entry'::text as category,
      'order-entry-photos'::text as bucket_id,
      p.storage_path as name
    from public.service_order_entry_photos p
    where p.organization_id = p_organization_id
      and nullif(trim(p.storage_path), '') is not null

    union all

    select
      'os_exit'::text as category,
      'order-exit-photos'::text as bucket_id,
      p.storage_path as name
    from public.service_order_exit_photos p
    where p.organization_id = p_organization_id
      and nullif(trim(p.storage_path), '') is not null

    union all

    select
      'os_assistance'::text as category,
      'order-assistance-photos'::text as bucket_id,
      p.storage_path as name
    from public.service_order_assistance_photos p
    where p.organization_id = p_organization_id
      and nullif(trim(p.storage_path), '') is not null

    union all

    select
      'whatsapp'::text as category,
      'whatsapp-media'::text as bucket_id,
      s.name
    from storage_sizes s
    where s.bucket_id = 'whatsapp-media'
      and s.name like (p_organization_id::text || '/%')

    union all

    select
      'resale'::text as category,
      'resale-device-photos'::text as bucket_id,
      d.image_storage_path as name
    from public.resale_devices d
    where d.organization_id = p_organization_id
      and nullif(trim(coalesce(d.image_storage_path, '')), '') is not null

    union all

    select
      'resale'::text as category,
      'resale-device-photos'::text as bucket_id,
      gallery_path as name
    from public.resale_devices d
    cross join lateral unnest(coalesce(d.image_gallery_paths, '{}'::text[])) as gallery_path
    where d.organization_id = p_organization_id
      and nullif(trim(gallery_path), '') is not null
  ),
  category_totals as (
    select
      p.category,
      count(distinct (p.bucket_id || '/' || p.name))::integer as file_count,
      coalesce(sum(s.size_bytes), 0)::bigint as bytes
    from category_paths p
    left join storage_sizes s
      on s.bucket_id = p.bucket_id
     and s.name = p.name
    group by p.category
  ),
  categories as (
    select *
    from (
      values
        ('os_entry'::text, 'Fotos de entrada de OS'::text),
        ('os_exit'::text, 'Fotos de saída de OS'::text),
        ('os_assistance'::text, 'Fotos da assistência de OS'::text),
        ('whatsapp'::text, 'Imagens do WhatsApp'::text),
        ('resale'::text, 'Fotos de seminovos'::text)
    ) as c(category, label)
  )
  select jsonb_build_object(
    'project_total_bytes',
    coalesce((select sum(bytes) from project_buckets), 0),
    'project_buckets',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'bucketId', bucket_id,
          'fileCount', file_count,
          'bytes', bytes
        )
        order by bytes desc, bucket_id asc
      )
      from project_buckets
    ), '[]'::jsonb),
    'org_total_bytes',
    coalesce((select sum(bytes) from category_totals), 0),
    'org_categories',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', c.category,
          'label', c.label,
          'fileCount', coalesce(t.file_count, 0),
          'bytes', coalesce(t.bytes, 0)
        )
        order by
          case c.category
            when 'os_entry' then 1
            when 'os_exit' then 2
            when 'os_assistance' then 3
            when 'whatsapp' then 4
            when 'resale' then 5
            else 99
          end
      )
      from categories c
      left join category_totals t on t.category = c.category
    ), '[]'::jsonb)
  );
$$;
