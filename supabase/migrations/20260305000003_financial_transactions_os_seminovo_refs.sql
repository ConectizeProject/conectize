-- Referências a OS e seminovos em financial_transactions (para import de histórico)

alter table public.financial_transactions
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;

alter table public.financial_transactions
  add column if not exists resale_device_id uuid references public.resale_devices(id) on delete set null;

create index if not exists financial_transactions_service_order_id_idx
  on public.financial_transactions(service_order_id)
  where service_order_id is not null;

create index if not exists financial_transactions_resale_device_id_idx
  on public.financial_transactions(resale_device_id)
  where resale_device_id is not null;
