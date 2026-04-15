-- Tags: remove família redundante na tag; sugerido ao consumidor passa a usar custo + margem sobre a receita.

alter table public.pricing_tags
  drop constraint if exists pricing_tags_parts_family_check;

alter table public.pricing_tags
  drop column if exists parts_family;

comment on column public.pricing_tags.margin_bps is
  'Bps da margem de participação sobre o preço de venda final: (preço - custo) / preço = margin_bps/10_000; '
  'preço sugerido = arredondar_para_cima(custo * 10000 / (10000 - margin_bps)).';

create or replace function public.portal_retailer_catalog_prices (
  p_brand_id uuid default null,
  p_device_type_id uuid default null,
  p_device_model_id uuid default null
)
returns table (
  product_id uuid,
  product_name text,
  product_kind text,
  sale_price_cents integer,
  suggested_sale_cents integer,
  pricing_tag_id uuid,
  pricing_tag_name text,
  parts_family text,
  device_model_id uuid,
  device_model_label text,
  device_type_id uuid,
  device_type_name text,
  brand_id uuid,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      p.id as product_id,
      p.name as product_name,
      p.kind::text as product_kind,
      p.sale_price_cents,
      p.cost_price_cents,
      p.pricing_tag_id,
      pt.name as pricing_tag_name,
      p.parts_family::text as parts_family,
      dm.id as device_model_id,
      dm.model as device_model_label,
      dt.id as device_type_id,
      dt.name as device_type_name,
      db.id as brand_id,
      db.name as brand_name,
      coalesce(o.margin_bps, pt.margin_bps, 0) as margin_bps_eff,
      coalesce(o.min_suggested_sale_cents, pt.min_suggested_sale_cents) as min_suggested_eff
    from public.products p
    left join public.pricing_tags pt on pt.id = p.pricing_tag_id
    left join public.product_compatible_device_models pcdm on pcdm.product_id = p.id
    left join public.device_models dm on dm.id = pcdm.device_model_id
    left join public.device_types dt on dt.id = dm.device_type_id
    left join public.device_brands db on db.id = dt.brand_id
    left join public.pricing_tag_retailer_overrides o
      on o.pricing_tag_id = pt.id
      and o.retailer_user_id = auth.uid()
    where p.is_active = true
      and (
        (
          p_brand_id is null
          and p_device_type_id is null
          and p_device_model_id is null
        )
        or (
          pcdm.product_id is not null
          and (p_device_model_id is null or pcdm.device_model_id = p_device_model_id)
          and (p_device_type_id is null or dt.id = p_device_type_id)
          and (p_brand_id is null or db.id = p_brand_id)
        )
      )
  ),
  calc as (
    select
      f.*,
      case
        when f.cost_price_cents is null or f.cost_price_cents <= 0 then null::integer
        when f.margin_bps_eff <= 0 or f.margin_bps_eff >= 10000 then f.cost_price_cents
        else ceil(f.cost_price_cents::numeric * 10000.0 / (10000 - f.margin_bps_eff))::integer
      end as by_margin_cents
    from filtered f
  )
  select
    c.product_id,
    c.product_name,
    c.product_kind,
    c.sale_price_cents,
    case
      when c.by_margin_cents is null then null::integer
      else greatest(
        c.by_margin_cents,
        coalesce(c.min_suggested_eff, c.by_margin_cents)
      )
    end as suggested_sale_cents,
    c.pricing_tag_id,
    c.pricing_tag_name,
    c.parts_family,
    c.device_model_id,
    c.device_model_label,
    c.device_type_id,
    c.device_type_name,
    c.brand_id,
    c.brand_name
  from calc c
  where public.is_retailer() or public.is_staff_or_admin();
$$;

comment on function public.portal_retailer_catalog_prices (uuid, uuid, uuid) is
  'Catálogo comercial: preço de lista (sale) e sugerido ao consumidor, sem expor custo. '
  'Sugerido = max(arredondar_para_cima(custo * 10000 / (10000 - margin_bps)), mínimo efetivo em centavos); '
  'margin/min efetivos = override do lojista ou tag. Margem = (preço sugerido - custo) / preço sugerido.';
