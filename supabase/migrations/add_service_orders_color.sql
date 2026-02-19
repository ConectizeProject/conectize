-- Adiciona coluna color (cor do aparelho) em service_orders
alter table public.service_orders add column if not exists color text;
