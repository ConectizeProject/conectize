-- Estoque disponível após a venda (snapshot no momento do recebimento, ex.: Full no MELI).
alter table public.sales_order_items
  add column if not exists stock_after_sale integer null;

alter table public.sales_order_items
  drop constraint if exists sales_order_items_stock_after_sale_check;

alter table public.sales_order_items
  add constraint sales_order_items_stock_after_sale_check
  check (stock_after_sale is null or stock_after_sale >= 0);

comment on column public.sales_order_items.stock_after_sale is
  'Estoque disponível após esta venda (snapshot na criação/sync). Para Full MELI: saldo meli_facility.';
