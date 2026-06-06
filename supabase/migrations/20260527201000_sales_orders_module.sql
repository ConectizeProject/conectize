-- Pedidos de venda (Frente de Caixa): módulo separado do legado pos_sales.

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cash_session_id uuid not null references public.pos_cash_sessions(id) on delete restrict,
  order_number bigint not null,
  status text not null check (status in ('in_progress', 'paid', 'canceled')),
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text null,
  customer_type text not null default 'pessoa_fisica' check (customer_type in ('pessoa_fisica', 'pessoa_juridica')),
  customer_document text null,
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

create unique index if not exists sales_orders_org_order_number_uniq
  on public.sales_orders (organization_id, order_number);

create index if not exists sales_orders_org_status_created_idx
  on public.sales_orders (organization_id, status, created_at desc);

create index if not exists sales_orders_org_seller_idx
  on public.sales_orders (organization_id, seller_user_id, created_at desc);

create index if not exists sales_orders_org_cash_session_idx
  on public.sales_orders (organization_id, cash_session_id, created_at desc);

-- Numeração de pedido por organização (1, 2, 3… em cada empresa).
create or replace function public.sales_orders_assign_order_number ()
returns trigger
language plpgsql
as $$
declare
  next_num bigint;
begin
  if new.order_number is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.organization_id::text));

  select coalesce(max(s.order_number), 0) + 1
  into next_num
  from public.sales_orders s
  where s.organization_id = new.organization_id;

  new.order_number := next_num;
  return new;
end;
$$;

drop trigger if exists sales_orders_assign_order_number_trg on public.sales_orders;
create trigger sales_orders_assign_order_number_trg
  before insert on public.sales_orders
  for each row
  execute function public.sales_orders_assign_order_number();

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists sales_order_items_org_order_idx
  on public.sales_order_items (organization_id, sales_order_id);

create index if not exists sales_order_items_org_product_idx
  on public.sales_order_items (organization_id, product_id);

create table if not exists public.sales_order_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  payment_method_id uuid null references public.payment_methods(id) on delete set null,
  payment_method_type text not null check (payment_method_type in ('dinheiro', 'pix', 'credito', 'debito', 'outro')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'paid' check (status in ('pending', 'paid', 'canceled')),
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists sales_order_payments_org_order_idx
  on public.sales_order_payments (organization_id, sales_order_id);

create index if not exists sales_order_payments_org_method_idx
  on public.sales_order_payments (organization_id, payment_method_type, created_at desc);

-- FK financeiro para pedidos de venda
alter table public.financial_transactions
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

create index if not exists financial_transactions_sales_order_id_idx
  on public.financial_transactions (sales_order_id)
  where sales_order_id is not null;

-- Origem de estoque: incluir sales_order
alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_source_check;

alter table public.product_stock_movements
  add constraint product_stock_movements_source_check
  check (source in ('manual', 'bling', 'system', 'pdv_sale', 'service_order', 'sales_order'));

alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_source_ref_required_check;

alter table public.product_stock_movements
  add constraint product_stock_movements_source_ref_required_check
  check (
    source not in ('pdv_sale', 'service_order', 'sales_order')
    or (external_reference is not null and btrim(external_reference) <> '')
  );

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_order_payments enable row level security;

drop policy if exists sales_orders_staff_all on public.sales_orders;
create policy sales_orders_staff_all
  on public.sales_orders for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists sales_order_items_staff_all on public.sales_order_items;
create policy sales_order_items_staff_all
  on public.sales_order_items for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists sales_order_payments_staff_all on public.sales_order_payments;
create policy sales_order_payments_staff_all
  on public.sales_order_payments for all
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());
