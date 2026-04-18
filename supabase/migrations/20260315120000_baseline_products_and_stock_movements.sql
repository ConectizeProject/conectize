-- Baseline de produtos e movimentações de estoque.
-- Migrações antigas sem prefixo de timestamp eram ignoradas pelo CLI; 20260316000003+ assumem estas tabelas.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  bling_id text null,
  bling_sync_pending boolean not null default false,
  bling_sync_snapshot jsonb null,
  parent_bling_id text null,
  parent_product_id uuid null references public.products (id) on delete set null,
  name text not null,
  sku text null,
  barcode text null,
  description text null,
  sale_price_cents integer null,
  cost_price_cents integer null,
  is_active boolean not null default true,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_bling_id_idx on public.products (bling_id)
  where bling_id is not null;

create index if not exists products_parent_product_id_idx on public.products (parent_product_id)
  where parent_product_id is not null;

create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null
    constraint product_stock_movements_type_check
      check (type in ('entry', 'exit', 'loss')),
  quantity integer not null
    constraint product_stock_movements_quantity_pos_check
      check (quantity > 0),
  unit_value_cents bigint not null default 0,
  total_value_cents bigint not null default 0,
  source text not null default 'manual'
    constraint product_stock_movements_source_check
      check (source in ('manual', 'bling', 'system')),
  external_reference text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_stock_movements_product_id_idx
  on public.product_stock_movements (product_id);
