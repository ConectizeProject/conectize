-- Checklist de situação de entrada do aparelho na OS

alter table public.service_orders
  add column if not exists device_entry_checks jsonb;

