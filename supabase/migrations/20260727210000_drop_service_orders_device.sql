-- Remove coluna legada `device` de service_orders.
-- Fonte da verdade do aparelho: device_model_id → device_models → device_types → device_brands.

alter table public.service_orders
  drop column if exists device;
