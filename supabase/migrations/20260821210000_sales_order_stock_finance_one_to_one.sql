-- Garante 1 saída de estoque por item de venda (e 1 entrada por item de NF-e entrada).
-- A aplicação já tenta ser idempotente; o índice único fecha a janela de corrida no banco.

-- Deduplica saídas de pedido de venda com a mesma external_reference (mantém a mais antiga).
with ranked_sales_exits as (
  select
    id,
    row_number() over (
      partition by organization_id, external_reference
      order by created_at asc nulls last, id asc
    ) as rn
  from public.product_stock_movements
  where source = 'sales_order'
    and type = 'exit'
    and external_reference ~ '^sales_order:[0-9a-fA-F-]{36}:item:[0-9a-fA-F-]{36}$'
)
delete from public.product_stock_movements m
using ranked_sales_exits r
where m.id = r.id
  and r.rn > 1;

create unique index if not exists product_stock_movements_sales_order_item_exit_uidx
  on public.product_stock_movements (organization_id, external_reference)
  where source = 'sales_order'
    and type = 'exit'
    and external_reference ~ '^sales_order:[0-9a-fA-F-]{36}:item:[0-9a-fA-F-]{36}$';

-- Deduplica entradas de NF-e por item (ref …:item:{uuid}).
with ranked_nfe_entries as (
  select
    id,
    row_number() over (
      partition by organization_id, external_reference
      order by created_at asc nulls last, id asc
    ) as rn
  from public.product_stock_movements
  where source = 'nfe_entrada'
    and external_reference like '%:item:%'
)
delete from public.product_stock_movements m
using ranked_nfe_entries r
where m.id = r.id
  and r.rn > 1;

create unique index if not exists product_stock_movements_nfe_entrada_item_uidx
  on public.product_stock_movements (organization_id, external_reference)
  where source = 'nfe_entrada'
    and external_reference like '%:item:%';

-- Financeiro 1-1 com linha de pagamento do pedido.
alter table public.financial_transactions
  add column if not exists sales_order_payment_id uuid
    references public.sales_order_payments (id) on delete set null;

create index if not exists financial_transactions_sales_order_payment_id_idx
  on public.financial_transactions (sales_order_payment_id)
  where sales_order_payment_id is not null;

-- Deduplica lançamentos que já possam apontar para o mesmo pagamento (após backfill futuro).
with ranked_finance as (
  select
    id,
    row_number() over (
      partition by sales_order_payment_id
      order by created_at asc nulls last, id asc
    ) as rn
  from public.financial_transactions
  where sales_order_payment_id is not null
)
delete from public.financial_transactions t
using ranked_finance r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists financial_transactions_sales_order_payment_uidx
  on public.financial_transactions (sales_order_payment_id)
  where sales_order_payment_id is not null;
