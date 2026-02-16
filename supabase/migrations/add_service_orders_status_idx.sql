-- Índice para acelerar counts e filtros por status (dashboard, ordens)
create index if not exists service_orders_status_idx on public.service_orders(status);
