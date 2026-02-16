-- Adiciona coluna assistance_info (informações sobre a assistência) em service_orders
alter table public.service_orders add column if not exists assistance_info text;
