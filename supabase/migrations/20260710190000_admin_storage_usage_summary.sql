-- Uso de storage para painel admin.
-- A métrica oficial de billing do Supabase é agregada por período; esta função
-- mostra o tamanho atual dos objetos em storage.objects para orientar limpezas.

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
            when 'whatsapp' then 3
            when 'resale' then 4
            else 99
          end
      )
      from categories c
      left join category_totals t on t.category = c.category
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.admin_storage_usage_summary(uuid) to authenticated;
grant execute on function public.admin_storage_usage_summary(uuid) to service_role;
