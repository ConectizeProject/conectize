-- Datas de postagem / disponibilidade da etiqueta para o painel de envios.
alter table public.sales_orders
  add column if not exists ml_posting_deadline timestamptz null,
  add column if not exists ml_label_available_at timestamptz null;

create index if not exists sales_orders_org_ml_label_available_at_idx
  on public.sales_orders (organization_id, ml_label_available_at)
  where ml_order_id is not null and ml_label_available_at is not null;
