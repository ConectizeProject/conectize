-- Múltiplos métodos de pagamento na venda do seminovo (array JSONB).
-- Mantém payment_method_id e payment_installments para compatibilidade (primeiro método).
alter table public.resale_devices
  add column if not exists sale_payment_methods jsonb default '[]'::jsonb;

-- Migra dados existentes: um único método vira um item no array
update public.resale_devices
set sale_payment_methods = jsonb_build_array(
  jsonb_build_object(
    'payment_method_id', payment_method_id,
    'installments', coalesce(payment_installments, 1),
    'value_cents', null
  )
)
where payment_method_id is not null
  and (sale_payment_methods is null or sale_payment_methods = '[]'::jsonb);
