-- PDV (Ponto de Venda): caixa, vendas, itens e pagamentos.
-- Mantém padrão multiempresa com organization_id e RLS por contexto ativo.

create table if not exists public.pos_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opened_by uuid not null references auth.users(id) on delete restrict,
  closed_by uuid null references auth.users(id) on delete set null,
  opening_amount_cents integer not null default 0,
  closed_at timestamptz null,
  expected_cash_cents integer null,
  counted_cash_cents integer null,
  difference_cents integer null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_cash_sessions_org_created_idx
  on public.pos_cash_sessions (organization_id, created_at desc);

create index if not exists pos_cash_sessions_org_open_idx
  on public.pos_cash_sessions (organization_id, closed_at)
  where closed_at is null;

create table if not exists public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cash_session_id uuid not null references public.pos_cash_sessions(id) on delete cascade,
  type text not null check (type in ('sangria', 'suprimento')),
  amount_cents integer not null check (amount_cents > 0),
  reason text null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists pos_cash_movements_org_created_idx
  on public.pos_cash_movements (organization_id, created_at desc);

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cash_session_id uuid not null references public.pos_cash_sessions(id) on delete restrict,
  sale_number bigint generated always as identity,
  status text not null check (status in ('pending', 'paid', 'canceled')),
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  subtotal_cents integer not null default 0,
  discount_total_cents integer not null default 0,
  total_cents integer not null default 0,
  paid_amount_cents integer not null default 0,
  change_cents integer not null default 0,
  canceled_at timestamptz null,
  canceled_by uuid null references auth.users(id) on delete set null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_sales_org_sale_number_uniq
  on public.pos_sales (organization_id, sale_number);

create index if not exists pos_sales_org_status_created_idx
  on public.pos_sales (organization_id, status, created_at desc);

create index if not exists pos_sales_org_seller_idx
  on public.pos_sales (organization_id, seller_user_id, created_at desc);

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists pos_sale_items_org_sale_idx
  on public.pos_sale_items (organization_id, sale_id);

create index if not exists pos_sale_items_org_product_idx
  on public.pos_sale_items (organization_id, product_id);

create table if not exists public.pos_sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  payment_method_id uuid null references public.payment_methods(id) on delete set null,
  payment_method_type text not null check (payment_method_type in ('dinheiro', 'pix', 'credito', 'debito', 'outro')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'paid' check (status in ('pending', 'paid', 'canceled')),
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists pos_sale_payments_org_sale_idx
  on public.pos_sale_payments (organization_id, sale_id);

create index if not exists pos_sale_payments_org_method_idx
  on public.pos_sale_payments (organization_id, payment_method_type, created_at desc);

-- Origem padronizada para movimentação de estoque.
alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_source_check;

alter table public.product_stock_movements
  add constraint product_stock_movements_source_check
  check (source in ('manual', 'bling', 'system', 'pdv_sale', 'service_order'));

alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_source_ref_required_check;

alter table public.product_stock_movements
  add constraint product_stock_movements_source_ref_required_check
  check (
    source not in ('pdv_sale', 'service_order')
    or (external_reference is not null and btrim(external_reference) <> '')
  );

alter table public.pos_cash_sessions enable row level security;
alter table public.pos_cash_movements enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;
alter table public.pos_sale_payments enable row level security;

drop policy if exists pos_cash_sessions_staff_select on public.pos_cash_sessions;
create policy pos_cash_sessions_staff_select
  on public.pos_cash_sessions for select
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists pos_cash_sessions_staff_all on public.pos_cash_sessions;
create policy pos_cash_sessions_staff_all
  on public.pos_cash_sessions for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists pos_cash_movements_staff_all on public.pos_cash_movements;
create policy pos_cash_movements_staff_all
  on public.pos_cash_movements for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists pos_sales_staff_all on public.pos_sales;
create policy pos_sales_staff_all
  on public.pos_sales for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists pos_sale_items_staff_all on public.pos_sale_items;
create policy pos_sale_items_staff_all
  on public.pos_sale_items for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists pos_sale_payments_staff_all on public.pos_sale_payments;
create policy pos_sale_payments_staff_all
  on public.pos_sale_payments for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

