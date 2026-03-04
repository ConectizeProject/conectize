-- device_type_id já referencia device_types, que por sua vez referencia device_brands.
-- Redundante guardar brand_id em device_models.
alter table public.device_models
  drop column if exists brand_id;
