-- Vínculo do pedido de venda local com pedido/NFC-e no Bling.

alter table public.sales_orders
  add column if not exists bling_pedido_id text null,
  add column if not exists bling_nfce_id text null,
  add column if not exists bling_synced_at timestamptz null,
  add column if not exists bling_last_error text null;

create index if not exists sales_orders_org_bling_pedido_idx
  on public.sales_orders (organization_id, bling_pedido_id)
  where bling_pedido_id is not null;
