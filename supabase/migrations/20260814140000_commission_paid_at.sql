-- Controle de pagamento de comissões (OS finalizada e aparelho vendido)

alter table public.service_orders
  add column if not exists commission_paid_at timestamptz;

alter table public.resale_devices
  add column if not exists commission_paid_at timestamptz;

create index if not exists service_orders_commission_pending_idx
  on public.service_orders (organization_id, closed_at desc)
  where commission_user_id is not null and commission_paid_at is null;

create index if not exists resale_devices_commission_pending_idx
  on public.resale_devices (organization_id, sale_date desc)
  where sold = true and commission_paid_at is null;
