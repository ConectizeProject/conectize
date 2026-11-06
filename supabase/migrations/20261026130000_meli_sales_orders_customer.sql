alter table public.sales_orders
  add column if not exists customer_id uuid null references public.customers(id) on delete set null;

create index if not exists sales_orders_org_customer_id_idx
  on public.sales_orders (organization_id, customer_id)
  where customer_id is not null;
