-- Importa histórico de OS e vendas de seminovos para financial_transactions
-- Execute no SQL Editor do Supabase
-- Idempotente: pode rodar mais de uma vez sem duplicar registros
--
-- PRÉ-REQUISITO: Execute PRIMEIRO o arquivo setup_financeiro.sql

begin;

-- Inserir OS encerradas (lucro = services_total - services_cost)
-- Apenas ordens com status finalizado, closed_at preenchido e conta válida
insert into public.financial_transactions (
  conta_id,
  amount_cents,
  type,
  description,
  occurred_at,
  service_order_id,
  resale_device_id
)
select
  pm.conta_id,
  coalesce(so.services_total_cents, 0) - coalesce(so.services_cost_total_cents, 0),
  case when (coalesce(so.services_total_cents, 0) - coalesce(so.services_cost_total_cents, 0)) >= 0 then 'entrada' else 'saida' end,
  'OS #' || coalesce(so.display_number::text, so.id::text),
  (so.closed_at::date),
  so.id,
  null
from public.service_orders so
cross join lateral (
  select (elem->>'payment_method_id')::uuid as pm_id
  from jsonb_array_elements(coalesce(so.payment_methods, '[]'::jsonb)) with ordinality t(elem, ord)
  limit 1
) first_pm
join public.payment_methods pm on pm.id = first_pm.pm_id and pm.conta_id is not null
where so.status in ('finalizada', 'finalizada_sem_conserto', 'finalizada_sem_aprovacao', 'cancelada')
  and so.closed_at is not null
  and not exists (
    select 1 from public.financial_transactions ft
    where ft.service_order_id = so.id
  );

-- Inserir vendas de seminovos
-- Apenas vendas com valor, data e conta vinculada
insert into public.financial_transactions (
  conta_id,
  amount_cents,
  type,
  description,
  occurred_at,
  service_order_id,
  resale_device_id
)
select
  pm.conta_id,
  rd.sold_for_cents,
  'entrada',
  'Venda: ' || coalesce(
    nullif(trim(coalesce(rd.device_name, '') || ' — ' || coalesce(rd.model, '')), ' — '),
    'Seminovo'
  ),
  coalesce(rd.sale_date, current_date),
  null,
  rd.id
from public.resale_devices rd
join public.payment_methods pm on pm.id = rd.payment_method_id and pm.conta_id is not null
where rd.sold = true
  and rd.sold_for_cents is not null
  and rd.sale_date is not null
  and not exists (
    select 1 from public.financial_transactions ft
    where ft.resale_device_id = rd.id
  );

commit;
