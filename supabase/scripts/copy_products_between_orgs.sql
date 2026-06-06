-- Copia produtos (pais + variações), tags de precificação, modelos compatíveis,
-- contas (carteiras) e formas de pagamento da Conectize para outra organização (ex.: Vritu Ltda).
--
-- Pré-requisito: catálogo de dispositivos já copiado no destino
--   (supabase/scripts/copy_device_catalog_between_orgs.sql)
--
-- Não copia: movimentações de estoque, transações financeiras, vínculos Bling (bling_id fica null).
-- Idempotente: reexecutar não duplica registros já existentes no destino.
--
-- Organizações (confirmadas em produção):
--   Conectize: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 (slug: conectize)
--   Vritu:     464400e2-d639-44ff-81db-7a19d3a795b6 (slug: vritu-ltda)

begin;

with params as (
  select
    src.id as src_org,
    dst.id as dst_org,
    (
      select om.user_id
      from public.organization_members om
      where om.organization_id = dst.id
        and om.role_in_org = 'admin'
      order by om.user_id
      limit 1
    ) as dst_created_by
  from public.organizations src
  cross join public.organizations dst
  where src.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
    and dst.id = '464400e2-d639-44ff-81db-7a19d3a795b6'::uuid
),
ins_contas as (
  insert into public.contas (
    name,
    saldo_inicial_cents,
    deleted_at,
    organization_id,
    created_at,
    updated_at
  )
  select
    src.name,
    src.saldo_inicial_cents,
    src.deleted_at,
    p.dst_org,
    src.created_at,
    src.updated_at
  from public.contas src
  cross join params p
  where src.organization_id = p.src_org
    and p.dst_org is not null
    and not exists (
      select 1
      from public.contas dst
      where dst.organization_id = p.dst_org
        and dst.name = src.name
        and coalesce(dst.deleted_at::text, '') = coalesce(src.deleted_at::text, '')
    )
  returning id
),
conta_map as (
  select
    src.id as src_id,
    dst.id as dst_id
  from public.contas src
  cross join params p
  join public.contas dst
    on dst.organization_id = p.dst_org
   and dst.name = src.name
   and coalesce(dst.deleted_at::text, '') = coalesce(src.deleted_at::text, '')
  where src.organization_id = p.src_org
),
ins_payment_methods as (
  insert into public.payment_methods (
    description,
    type,
    fee_percent,
    credit_installment_fees,
    sort_order,
    conta_id,
    organization_id,
    created_at,
    updated_at
  )
  select
    src.description,
    src.type,
    src.fee_percent,
    src.credit_installment_fees,
    src.sort_order,
    cm.dst_id,
    p.dst_org,
    src.created_at,
    src.updated_at
  from public.payment_methods src
  cross join params p
  left join conta_map cm on cm.src_id = src.conta_id
  where src.organization_id = p.src_org
    and p.dst_org is not null
    and not exists (
      select 1
      from public.payment_methods dst
      where dst.organization_id = p.dst_org
        and dst.type = src.type
        and dst.description = src.description
        and dst.sort_order = src.sort_order
    )
  returning id
),
upd_payment_methods_conta as (
  update public.payment_methods dst
  set
    conta_id = cm.dst_id,
    fee_percent = src.fee_percent,
    credit_installment_fees = src.credit_installment_fees,
    updated_at = src.updated_at
  from public.payment_methods src
  cross join params p
  join conta_map cm on cm.src_id = src.conta_id
  where src.organization_id = p.src_org
    and dst.organization_id = p.dst_org
    and dst.type = src.type
    and dst.description = src.description
    and dst.sort_order = src.sort_order
    and src.conta_id is not null
    and (
      dst.conta_id is distinct from cm.dst_id
      or dst.fee_percent is distinct from src.fee_percent
      or dst.credit_installment_fees is distinct from src.credit_installment_fees
    )
  returning dst.id
),
ins_pricing_tags as (
  insert into public.pricing_tags (
    name,
    margin_bps,
    min_suggested_sale_cents,
    organization_id,
    created_at,
    updated_at
  )
  select
    pt.name,
    pt.margin_bps,
    pt.min_suggested_sale_cents,
    p.dst_org,
    pt.created_at,
    pt.updated_at
  from public.pricing_tags pt
  cross join params p
  where pt.organization_id = p.src_org
    and p.dst_org is not null
    and not exists (
      select 1
      from public.pricing_tags existing
      where existing.organization_id = p.dst_org
        and existing.name = pt.name
    )
  returning 1
),
tag_map as (
  select
    src_pt.id as src_id,
    dst_pt.id as dst_id
  from public.pricing_tags src_pt
  cross join params p
  join public.pricing_tags dst_pt
    on dst_pt.organization_id = p.dst_org
   and dst_pt.name = src_pt.name
  where src_pt.organization_id = p.src_org
),
device_model_map as (
  select
    sm_src.id as src_id,
    dm_dst.id as dst_id
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
  join public.device_models dm_dst
    on dm_dst.organization_id = p.dst_org
   and dm_dst.device_type_id = dt_dst.id
   and dm_dst.model = sm_src.model
  where sm_src.organization_id = p.src_org
),
ins_parent_products as (
  insert into public.products (
    organization_id,
    bling_id,
    bling_sync_pending,
    bling_sync_snapshot,
    parent_bling_id,
    parent_product_id,
    name,
    sku,
    barcode,
    description,
    sale_price_cents,
    cost_price_cents,
    cost_price_manual_edited_at,
    is_active,
    image_url,
    kind,
    pricing_tag_id,
    catalog_sort_key,
    variation_attribute_keys,
    variation_attribute_values,
    created_by,
    created_at,
    updated_at
  )
  select
    p.dst_org,
    null,
    false,
    null,
    null,
    null,
    src.name,
    src.sku,
    src.barcode,
    src.description,
    src.sale_price_cents,
    src.cost_price_cents,
    src.cost_price_manual_edited_at,
    src.is_active,
    src.image_url,
    src.kind,
    tm.dst_id,
    src.catalog_sort_key,
    src.variation_attribute_keys,
    src.variation_attribute_values,
    p.dst_created_by,
    src.created_at,
    src.updated_at
  from public.products src
  cross join params p
  left join tag_map tm on tm.src_id = src.pricing_tag_id
  where src.organization_id = p.src_org
    and p.dst_org is not null
    and p.dst_created_by is not null
    and src.parent_product_id is null
    and not exists (
      select 1
      from public.products dst
      where dst.organization_id = p.dst_org
        and dst.parent_product_id is null
        and dst.name = src.name
        and coalesce(dst.sku, '') = coalesce(src.sku, '')
    )
  returning id
),
parent_product_map as (
  select
    src.id as src_id,
    dst.id as dst_id
  from public.products src
  cross join params p
  join public.products dst
    on dst.organization_id = p.dst_org
   and dst.parent_product_id is null
   and dst.name = src.name
   and coalesce(dst.sku, '') = coalesce(src.sku, '')
  where src.organization_id = p.src_org
    and src.parent_product_id is null
),
ins_variation_products as (
  insert into public.products (
    organization_id,
    bling_id,
    bling_sync_pending,
    bling_sync_snapshot,
    parent_bling_id,
    parent_product_id,
    name,
    sku,
    barcode,
    description,
    sale_price_cents,
    cost_price_cents,
    cost_price_manual_edited_at,
    is_active,
    image_url,
    kind,
    pricing_tag_id,
    catalog_sort_key,
    variation_attribute_keys,
    variation_attribute_values,
    created_by,
    created_at,
    updated_at
  )
  select
    p.dst_org,
    null,
    false,
    null,
    null,
    ppm.dst_id,
    src.name,
    src.sku,
    src.barcode,
    src.description,
    src.sale_price_cents,
    src.cost_price_cents,
    src.cost_price_manual_edited_at,
    src.is_active,
    src.image_url,
    src.kind,
    tm.dst_id,
    src.catalog_sort_key,
    src.variation_attribute_keys,
    src.variation_attribute_values,
    p.dst_created_by,
    src.created_at,
    src.updated_at
  from public.products src
  cross join params p
  join parent_product_map ppm on ppm.src_id = src.parent_product_id
  left join tag_map tm on tm.src_id = src.pricing_tag_id
  where src.organization_id = p.src_org
    and p.dst_created_by is not null
    and src.parent_product_id is not null
    and not exists (
      select 1
      from public.products dst
      where dst.organization_id = p.dst_org
        and dst.parent_product_id = ppm.dst_id
        and dst.name = src.name
        and coalesce(dst.sku, '') = coalesce(src.sku, '')
        and dst.variation_attribute_values = src.variation_attribute_values
    )
  returning id
),
product_map as (
  select
    src.id as src_id,
    dst.id as dst_id
  from public.products src
  cross join params p
  join public.products dst
    on dst.organization_id = p.dst_org
   and dst.name = src.name
   and coalesce(dst.sku, '') = coalesce(src.sku, '')
   and (
     (src.parent_product_id is null and dst.parent_product_id is null)
     or (
       src.parent_product_id is not null
       and dst.parent_product_id is not null
       and exists (
         select 1
         from parent_product_map ppm
         where ppm.src_id = src.parent_product_id
           and ppm.dst_id = dst.parent_product_id
       )
       and dst.variation_attribute_values = src.variation_attribute_values
     )
   )
  where src.organization_id = p.src_org
),
ins_compatible_models as (
  insert into public.product_compatible_device_models (
    product_id,
    device_model_id,
    organization_id
  )
  select
    pm.dst_id,
    dmm.dst_id,
    p.dst_org
  from public.product_compatible_device_models pcdm
  cross join params p
  join product_map pm on pm.src_id = pcdm.product_id
  join device_model_map dmm on dmm.src_id = pcdm.device_model_id
  on conflict (product_id, device_model_id) do nothing
  returning 1
)
select
  (select count(*) from ins_contas) as contas_inseridas,
  (select count(*) from ins_payment_methods) as formas_pagamento_inseridas,
  (select count(*) from upd_payment_methods_conta) as formas_pagamento_atualizadas,
  (select count(*) from ins_pricing_tags) as pricing_tags_inseridas,
  (select count(*) from ins_parent_products) as produtos_pais_inseridos,
  (select count(*) from ins_variation_products) as variacoes_inseridas,
  (select count(*) from ins_compatible_models) as compatibilidades_inseridas,
  (select src_org from params) as org_origem,
  (select dst_org from params) as org_destino;

commit;

-- Contagens no destino
select json_agg(row_to_json(t))
from (
  select 'pricing_tags' as kind, count(*)::int as count
  from public.pricing_tags pt
  join public.organizations o on o.id = pt.organization_id
  where o.name ilike '%vritu%'
  union all
  select 'products', count(*)::int
  from public.products p
  join public.organizations o on o.id = p.organization_id
  where o.name ilike '%vritu%'
  union all
  select 'product_compatible_device_models', count(*)::int
  from public.product_compatible_device_models pcm
  join public.organizations o on o.id = pcm.organization_id
  where o.name ilike '%vritu%'
  union all
  select 'contas', count(*)::int
  from public.contas c
  join public.organizations o on o.id = c.organization_id
  where o.name ilike '%vritu%'
  union all
  select 'payment_methods', count(*)::int
  from public.payment_methods pm
  join public.organizations o on o.id = pm.organization_id
  where o.name ilike '%vritu%'
) t;
