-- OS: 1 saída de estoque por produto (ref base) e chave estável no financeiro.

-- Deduplica saídas de OS com a mesma external_reference (mantém a mais antiga).
with ranked_os_exits as (
  select
    id,
    row_number() over (
      partition by organization_id, external_reference
      order by created_at asc nulls last, id asc
    ) as rn
  from public.product_stock_movements
  where source = 'service_order'
    and type = 'exit'
    and external_reference like 'service_order:%'
)
delete from public.product_stock_movements m
using ranked_os_exits r
where m.id = r.id
  and r.rn > 1;

create unique index if not exists product_stock_movements_service_order_exit_uidx
  on public.product_stock_movements (organization_id, external_reference)
  where source = 'service_order'
    and type = 'exit'
    and external_reference like 'service_order:%';

-- Chave de idempotência financeira (OS não tem tabela de pagamentos normalizada).
alter table public.financial_transactions
  add column if not exists source_key text null;

create index if not exists financial_transactions_source_key_idx
  on public.financial_transactions (organization_id, source_key)
  where source_key is not null;

with ranked_source_keys as (
  select
    id,
    row_number() over (
      partition by organization_id, source_key
      order by created_at asc nulls last, id asc
    ) as rn
  from public.financial_transactions
  where source_key is not null
)
delete from public.financial_transactions t
using ranked_source_keys r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists financial_transactions_org_source_key_uidx
  on public.financial_transactions (organization_id, source_key)
  where source_key is not null;
