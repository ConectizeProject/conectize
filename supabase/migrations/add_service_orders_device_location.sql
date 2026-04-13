-- Localização física do aparelho na assistência (texto livre)

alter table public.service_orders
  add column if not exists device_location text;
