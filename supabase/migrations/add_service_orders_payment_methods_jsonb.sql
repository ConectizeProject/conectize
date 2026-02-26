-- Adiciona coluna payment_methods (array de formas) e migra dados existentes
alter table public.service_orders
  add column if not exists payment_methods jsonb default '[]'::jsonb;

-- Migra payment_method_id e installments para payment_methods
update public.service_orders
set payment_methods = jsonb_build_array(
  jsonb_build_object(
    'payment_method_id', payment_method_id,
    'installments', coalesce(installments, 1)
  )
)
where payment_method_id is not null
  and (payment_methods is null or payment_methods = '[]'::jsonb);

-- Remove colunas antigas
alter table public.service_orders
  drop column if exists payment_method_id,
  drop column if exists installments;
