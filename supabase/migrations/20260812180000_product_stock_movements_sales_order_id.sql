-- Vincula movimentações de estoque ao pedido de venda (baixa/estorno).

alter table public.product_stock_movements
  add column if not exists sales_order_id uuid references public.sales_orders (id) on delete set null;

create index if not exists product_stock_movements_sales_order_id_idx
  on public.product_stock_movements (sales_order_id)
  where sales_order_id is not null;

create index if not exists product_stock_movements_org_sales_order_idx
  on public.product_stock_movements (organization_id, sales_order_id)
  where sales_order_id is not null;

-- Backfill a partir das referências já usadas pelo módulo de vendas.
update public.product_stock_movements m
set sales_order_id = (
  case
    when m.external_reference ~ '^sales_order:[0-9a-fA-F-]{36}:'
      then substring(m.external_reference from '^sales_order:([0-9a-fA-F-]{36}):')::uuid
    when m.external_reference ~ '^sales_order_cancel:[0-9a-fA-F-]{36}:'
      then substring(m.external_reference from '^sales_order_cancel:([0-9a-fA-F-]{36}):')::uuid
    when m.external_reference ~ '^sales_order_edit_rev:[0-9a-fA-F-]{36}:'
      then substring(m.external_reference from '^sales_order_edit_rev:([0-9a-fA-F-]{36}):')::uuid
    when m.external_reference ~ '^sales_order_stock_reverse:[0-9a-fA-F-]{36}:'
      then substring(m.external_reference from '^sales_order_stock_reverse:([0-9a-fA-F-]{36}):')::uuid
    else null
  end
)
where m.source = 'sales_order'
  and m.sales_order_id is null
  and m.external_reference is not null;
