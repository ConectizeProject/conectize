-- Entrada de usados (compra de cliente final → seminovos).

alter table public.resale_devices
  add column if not exists acquisition_source text not null default 'manual';

alter table public.resale_devices
  drop constraint if exists resale_devices_acquisition_source_check;

alter table public.resale_devices
  add constraint resale_devices_acquisition_source_check
  check (acquisition_source in ('manual', 'trade_in', 'customer_purchase'));

alter table public.resale_devices
  add column if not exists seller_customer_id uuid null references public.customers (id) on delete set null;

alter table public.resale_devices
  add column if not exists seller_name text null;

alter table public.resale_devices
  add column if not exists seller_document text null;

alter table public.resale_devices
  add column if not exists purchase_payment_methods jsonb null;

create index if not exists resale_devices_acquisition_source_idx
  on public.resale_devices (organization_id, acquisition_source)
  where acquisition_source <> 'manual';

create index if not exists resale_devices_seller_customer_id_idx
  on public.resale_devices (seller_customer_id)
  where seller_customer_id is not null;

comment on column public.resale_devices.acquisition_source is
  'Origem do aparelho: manual (cadastro), trade_in (troca na venda), customer_purchase (compra de cliente).';
comment on column public.resale_devices.purchase_payment_methods is
  'Formas de pagamento usadas na compra do usado (saída financeira). Mesmo formato de sale_payment_methods.';
