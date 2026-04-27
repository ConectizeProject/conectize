-- Copia catálogo de dispositivos (marcas → tipos → modelos) entre organizações.
-- Idempotente: ON CONFLICT DO NOTHING.
-- SQL puro (sem DO/variáveis PL/pgSQL) para rodar inteiro no editor do Supabase.
--
-- Troque os dois uuid em `params` se precisar.

begin;

with params as (
  select
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid as src_org,
    '583cbec3-759b-4e7b-a863-86141d8a076b'::uuid as dst_org
),
ins_brands as (
  insert into public.device_brands (name, organization_id)
  select sb.name, p.dst_org
  from public.device_brands sb
  cross join params p
  where sb.organization_id = p.src_org
  on conflict (organization_id, name) do nothing
  returning 1
),
ins_types as (
  insert into public.device_types (brand_id, name, organization_id)
  select db_dst.id, st_src.name, p.dst_org
  from public.device_types st_src
  cross join params p
  join public.device_brands sb_src
    on sb_src.id = st_src.brand_id
   and sb_src.organization_id = p.src_org
  join public.device_brands db_dst
    on db_dst.organization_id = p.dst_org
   and db_dst.name = sb_src.name
  where st_src.organization_id = p.src_org
  on conflict (organization_id, brand_id, name) do nothing
  returning 1
),
ins_models as (
  insert into public.device_models (device_type_id, model, organization_id)
  select dt_dst.id, sm_src.model, p.dst_org
  from public.device_models sm_src
  cross join params p
  join public.device_types st_src
    on st_src.id = sm_src.device_type_id
   and st_src.organization_id = p.src_org
  join public.device_brands sb_src
    on sb_src.id = st_src.brand_id
   and sb_src.organization_id = p.src_org
  join public.device_brands db_dst
    on db_dst.organization_id = p.dst_org
   and db_dst.name = sb_src.name
  join public.device_types dt_dst
    on dt_dst.organization_id = p.dst_org
   and dt_dst.brand_id = db_dst.id
   and dt_dst.name = st_src.name
  where sm_src.organization_id = p.src_org
  on conflict (organization_id, device_type_id, model) do nothing
  returning 1
)
select
  (select count(*) from ins_brands) as inserted_brand_rows_returned,
  (select count(*) from ins_types) as inserted_type_rows_returned,
  (select count(*) from ins_models) as inserted_model_rows_returned;

commit;

-- Contagens totais no destino (mesmo uuid do dst_org em params)
select json_agg(row_to_json(t))
from (
  select 'brands' as kind, count(*)::int as count
  from public.device_brands
  where organization_id = '583cbec3-759b-4e7b-a863-86141d8a076b'::uuid
  union all
  select 'types', count(*)::int
  from public.device_types
  where organization_id = '583cbec3-759b-4e7b-a863-86141d8a076b'::uuid
  union all
  select 'models', count(*)::int
  from public.device_models
  where organization_id = '583cbec3-759b-4e7b-a863-86141d8a076b'::uuid
) t;
