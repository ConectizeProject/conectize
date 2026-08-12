-- Copia contas (carteiras) e formas de pagamento da Conectize para a Vritu.
-- Idempotente: reexecutar não duplica; atualiza vínculos/taxas dos métodos já existentes.
--
-- Conectize: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Vritu:     464400e2-d639-44ff-81db-7a19d3a795b6

begin;

with params as (
  select
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid as src_org,
    '464400e2-d639-44ff-81db-7a19d3a795b6'::uuid as dst_org
),
ins_contas as (
  insert into public.contas (
    name,
    saldo_inicial_cents,
    deleted_at,
    organization_id,
    created_at,
    updated_at
  )
  select
    src.name,
    src.saldo_inicial_cents,
    src.deleted_at,
    p.dst_org,
    src.created_at,
    src.updated_at
  from public.contas src
  cross join params p
  where src.organization_id = p.src_org
    and not exists (
      select 1
      from public.contas dst
      where dst.organization_id = p.dst_org
        and dst.name = src.name
        and coalesce(dst.deleted_at::text, '') = coalesce(src.deleted_at::text, '')
    )
  returning id
),
conta_map as (
  select
    src.id as src_id,
    dst.id as dst_id
  from public.contas src
  cross join params p
  join public.contas dst
    on dst.organization_id = p.dst_org
   and dst.name = src.name
   and coalesce(dst.deleted_at::text, '') = coalesce(src.deleted_at::text, '')
  where src.organization_id = p.src_org
),
ins_payment_methods as (
  insert into public.payment_methods (
    description,
    type,
    fee_percent,
    credit_installment_fees,
    sort_order,
    conta_id,
    organization_id,
    created_at,
    updated_at
  )
  select
    src.description,
    src.type,
    src.fee_percent,
    src.credit_installment_fees,
    src.sort_order,
    cm.dst_id,
    p.dst_org,
    src.created_at,
    src.updated_at
  from public.payment_methods src
  cross join params p
  left join conta_map cm on cm.src_id = src.conta_id
  where src.organization_id = p.src_org
    and not exists (
      select 1
      from public.payment_methods dst
      where dst.organization_id = p.dst_org
        and dst.type = src.type
        and dst.description = src.description
        and dst.sort_order = src.sort_order
    )
  returning id
),
upd_payment_methods_conta as (
  update public.payment_methods dst
  set
    conta_id = cm.dst_id,
    fee_percent = src.fee_percent,
    credit_installment_fees = src.credit_installment_fees,
    updated_at = src.updated_at
  from public.payment_methods src
  cross join params p
  join conta_map cm on cm.src_id = src.conta_id
  where src.organization_id = p.src_org
    and dst.organization_id = p.dst_org
    and dst.type = src.type
    and dst.description = src.description
    and dst.sort_order = src.sort_order
    and src.conta_id is not null
    and (
      dst.conta_id is distinct from cm.dst_id
      or dst.fee_percent is distinct from src.fee_percent
      or dst.credit_installment_fees is distinct from src.credit_installment_fees
    )
  returning dst.id
)
select
  (select count(*) from ins_contas) as contas_inseridas,
  (select count(*) from ins_payment_methods) as formas_pagamento_inseridas,
  (select count(*) from upd_payment_methods_conta) as formas_pagamento_atualizadas,
  (select src_org from params) as org_origem,
  (select dst_org from params) as org_destino;

commit;

-- Conferência na Vritu
select
  c.name as conta,
  c.saldo_inicial_cents,
  c.deleted_at,
  pm.description as forma_pagamento,
  pm.type,
  pm.fee_percent,
  pm.sort_order
from public.contas c
full join public.payment_methods pm
  on pm.conta_id = c.id
 and pm.organization_id = c.organization_id
where coalesce(c.organization_id, pm.organization_id) = '464400e2-d639-44ff-81db-7a19d3a795b6'::uuid
order by pm.sort_order nulls last, c.name;
