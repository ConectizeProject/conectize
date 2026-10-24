-- Estoque virtual por composição: o saldo do produto kit é calculado
-- a partir dos componentes (produto + quantidade por unidade).

create table if not exists public.product_stock_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  component_product_id uuid not null references public.products (id) on delete restrict,
  quantity_per_unit integer not null
    constraint product_stock_components_qty_pos_check check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_stock_components_not_self check (product_id <> component_product_id),
  constraint product_stock_components_unique unique (product_id, component_product_id)
);

create index if not exists product_stock_components_org_idx
  on public.product_stock_components (organization_id);

create index if not exists product_stock_components_product_idx
  on public.product_stock_components (product_id);

create index if not exists product_stock_components_component_idx
  on public.product_stock_components (component_product_id);

comment on table public.product_stock_components is
  'Composição de estoque virtual: 1 unidade de product_id consome quantity_per_unit de component_product_id.';

alter table public.product_stock_components enable row level security;

drop policy if exists product_stock_components_staff_admin_all on public.product_stock_components;
create policy product_stock_components_staff_admin_all
  on public.product_stock_components for all to authenticated
  using (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  );

-- Produto com composição não guarda estoque próprio.
create or replace function public.product_has_stock_components (p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.product_stock_components c
    where c.product_id = p_product_id
  );
$$;

create or replace function public.trg_reject_stock_on_virtual_product ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.product_has_stock_components(new.product_id) then
    raise exception 'virtual_product_cannot_have_stock'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists product_stock_movements_reject_virtual on public.product_stock_movements;
create trigger product_stock_movements_reject_virtual
  before insert or update of product_id
  on public.product_stock_movements
  for each row
  execute function public.trg_reject_stock_on_virtual_product ();

-- Ao criar composição, limpa movimentos órfãos do kit (se houver).
create or replace function public.trg_clear_virtual_product_stock ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_stock_movements
  where product_id = new.product_id;
  return new;
end;
$$;

drop trigger if exists product_stock_components_clear_kit_stock on public.product_stock_components;
create trigger product_stock_components_clear_kit_stock
  after insert
  on public.product_stock_components
  for each row
  execute function public.trg_clear_virtual_product_stock ();
