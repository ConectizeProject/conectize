-- Cobrança adicional no pedido de venda (PDV).

alter table public.sales_orders
  add column if not exists surcharge_cents integer not null default 0;

alter table public.sales_orders
  drop constraint if exists sales_orders_surcharge_cents_check;

alter table public.sales_orders
  add constraint sales_orders_surcharge_cents_check check (surcharge_cents >= 0);
