-- Vínculo de pedidos de venda e produtos com o Mercado Livre.

alter table public.sales_orders
  add column if not exists ml_order_id text null,
  add column if not exists ml_pack_id text null;

create unique index if not exists sales_orders_org_ml_order_id_uidx
  on public.sales_orders (organization_id, ml_order_id)
  where ml_order_id is not null;

create index if not exists sales_orders_org_ml_pack_id_idx
  on public.sales_orders (organization_id, ml_pack_id)
  where ml_pack_id is not null;

alter table public.products
  add column if not exists ml_item_id text null;

create index if not exists products_org_ml_item_id_idx
  on public.products (organization_id, ml_item_id)
  where ml_item_id is not null;
