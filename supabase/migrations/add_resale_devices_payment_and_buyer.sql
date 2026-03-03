-- Campos adicionais para venda de aparelhos seminovos:
-- - Forma de pagamento
-- - Parcelas (quando aplicável)
-- - Dados do comprador
-- - Detalhes do aparelho exibidos no termo de compra

alter table public.resale_devices
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null,
  add column if not exists payment_installments integer,
  add column if not exists buyer_name text,
  add column if not exists buyer_cpf text,
  add column if not exists sale_details text;

create index if not exists resale_devices_payment_method_id_idx
  on public.resale_devices(payment_method_id);

