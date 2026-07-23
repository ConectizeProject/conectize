-- Remove coluna legada `service` de service_orders (substituída por `services` jsonb + `title`).

alter table public.service_orders
  drop column if exists service;
