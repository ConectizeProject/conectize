-- Adiciona coluna closed_at em service_orders (preenchida quando status é finalizado)
alter table public.service_orders add column if not exists closed_at timestamptz;
