-- Catálogo comercial (lojista): tags de precificação, modelos compatíveis, colunas em products
-- e RLS (leitura device_* + RPC sem cost_price_cents).

-- =========================
-- parts_family (text + check; espelha enum de negócio)
-- =========================

-- =========================
-- pricing_tags
-- =========================

create table if not exists public.pricing_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parts_family text null
    constraint pricing_tags_parts_family_check
      check (parts_family is null or parts_family in ('display', 'glass', 'battery', 'connector')),
  -- Margem sobre o preço de venda sugerido (lado consumidor): fração em bps do preço final (0–9999).
  margin_bps integer null
    constraint pricing_tags_margin_bps_check
      check (margin_bps is null or (margin_bps >= 0 and margin_bps < 10000)),
  min_suggested_sale_cents integer null
    constraint pricing_tags_min_suggested_nonneg_check
      check (min_suggested_sale_cents is null or min_suggested_sale_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_tags_name_idx on public.pricing_tags (name);

comment on table public.pricing_tags is
  'Regras globais de precificação sugerida ao lojista (margem sobre preço de venda; mínimo opcional).';
comment on column public.pricing_tags.margin_bps is
  'Bps da margem desejada sobre o preço de venda final; sugerido = arredondar_para_cima(preço_base * 10000 / (10000 - margin_bps)).';
comment on column public.pricing_tags.min_suggested_sale_cents is
  'Piso em centavos para o preço sugerido: max(cálculo_por_margem, mínimo efetivo).';

-- =========================
-- pricing_tag_retailer_overrides (por auth user = retailer)
-- =========================

create table if not exists public.pricing_tag_retailer_overrides (
  id uuid primary key default gen_random_uuid(),
  pricing_tag_id uuid not null references public.pricing_tags (id) on delete cascade,
  retailer_user_id uuid not null references auth.users (id) on delete cascade,
  margin_bps integer null
    constraint pricing_tag_retailer_overrides_margin_bps_check
      check (margin_bps is null or (margin_bps >= 0 and margin_bps < 10000)),
  min_suggested_sale_cents integer null
    constraint pricing_tag_retailer_overrides_min_nonneg_check
      check (min_suggested_sale_cents is null or min_suggested_sale_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_tag_retailer_overrides_tag_user_unique unique (pricing_tag_id, retailer_user_id)
);

create index if not exists pricing_tag_retailer_overrides_retailer_user_id_idx
  on public.pricing_tag_retailer_overrides (retailer_user_id);

comment on table public.pricing_tag_retailer_overrides is
  'Override de margem / mínimo sugerido por lojista (auth.users.id).';

-- =========================
-- products: pricing_tag_id + parts_family
-- =========================

alter table public.products
  add column if not exists pricing_tag_id uuid null references public.pricing_tags (id) on delete set null;

alter table public.products
  add column if not exists parts_family text null
    constraint products_parts_family_check
      check (parts_family is null or parts_family in ('display', 'glass', 'battery', 'connector'));

create index if not exists products_pricing_tag_id_idx on public.products (pricing_tag_id);

comment on column public.products.pricing_tag_id is 'Tag de precificação (regra de sugestão ao lojista).';
comment on column public.products.parts_family is 'Família de peça/serviço opcional no produto (sobrescreve a da tag quando aplicável na UI).';

-- =========================
-- product_compatible_device_models
-- =========================

create table if not exists public.product_compatible_device_models (
  product_id uuid not null references public.products (id) on delete cascade,
  device_model_id uuid not null references public.device_models (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_compatible_device_models_pkey primary key (product_id, device_model_id)
);

create index if not exists product_compatible_device_models_device_model_id_idx
  on public.product_compatible_device_models (device_model_id);

comment on table public.product_compatible_device_models is
  'Associação N:N produto ↔ modelo de aparelho (catálogo / filtros).';

-- =========================
-- RLS: novas tabelas
-- =========================

alter table public.pricing_tags enable row level security;
alter table public.pricing_tag_retailer_overrides enable row level security;
alter table public.product_compatible_device_models enable row level security;

revoke all on table public.pricing_tags from anon;
revoke all on table public.pricing_tag_retailer_overrides from anon;
revoke all on table public.product_compatible_device_models from anon;

drop policy if exists "pricing_tags_staff_admin_all" on public.pricing_tags;
create policy "pricing_tags_staff_admin_all"
on public.pricing_tags
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "pricing_tags_retailer_select" on public.pricing_tags;
create policy "pricing_tags_retailer_select"
on public.pricing_tags
for select
to authenticated
using (public.is_retailer());

drop policy if exists "pricing_tag_retailer_overrides_staff_admin_all" on public.pricing_tag_retailer_overrides;
create policy "pricing_tag_retailer_overrides_staff_admin_all"
on public.pricing_tag_retailer_overrides
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "pricing_tag_retailer_overrides_retailer_select_own" on public.pricing_tag_retailer_overrides;
create policy "pricing_tag_retailer_overrides_retailer_select_own"
on public.pricing_tag_retailer_overrides
for select
to authenticated
using (
  public.is_retailer()
  and retailer_user_id = auth.uid()
);

drop policy if exists "product_compatible_device_models_staff_admin_all" on public.product_compatible_device_models;
create policy "product_compatible_device_models_staff_admin_all"
on public.product_compatible_device_models
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- =========================
-- Catálogo aparelhos: lojista só leitura (filtros da vitrine)
-- =========================

drop policy if exists "device_brands_retailer_select" on public.device_brands;
create policy "device_brands_retailer_select"
on public.device_brands
for select
to authenticated
using (public.is_retailer());

drop policy if exists "device_types_retailer_select" on public.device_types;
create policy "device_types_retailer_select"
on public.device_types
for select
to authenticated
using (public.is_retailer());

drop policy if exists "device_models_retailer_select" on public.device_models;
create policy "device_models_retailer_select"
on public.device_models
for select
to authenticated
using (public.is_retailer());

-- =========================
-- RPC: preços comerciais (sem custo); security definer + checagem de papel
-- =========================

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
      p.pricing_tag_id,
      pt.name as pricing_tag_name,
      coalesce(p.parts_family, pt.parts_family)::text as parts_family,
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
        when f.sale_price_cents is null then null::integer
        when f.margin_bps_eff <= 0 or f.margin_bps_eff >= 10000 then f.sale_price_cents
        else ceil(f.sale_price_cents::numeric * 10000.0 / (10000 - f.margin_bps_eff))::integer
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
  'Catálogo comercial: preço de lista (sale) e sugerido ao consumidor, sem custo. '
  'Sugerido = max(arredondar_para_cima(venda * 10000 / (10000 - margin_bps)), mínimo efetivo); '
  'margin/min efetivos = override do lojista ou tag.';

revoke all on function public.portal_retailer_catalog_prices (uuid, uuid, uuid) from public;
grant execute on function public.portal_retailer_catalog_prices (uuid, uuid, uuid) to authenticated;

-- Garante RLS + revoga anon nas novas tabelas (alinhado a 20260324120000)
do $$
declare
  tbl text;
  tables text[] := array[
    'pricing_tags',
    'pricing_tag_retailer_overrides',
    'product_compatible_device_models'
  ];
begin
  foreach tbl in array tables
  loop
    if exists (
      select 1
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('revoke all on table public.%I from anon', tbl);
    end if;
  end loop;
end $$;
