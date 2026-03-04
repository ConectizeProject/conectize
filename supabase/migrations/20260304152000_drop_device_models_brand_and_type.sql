-- Remove colunas textuais redundantes em device_models.
-- Agora usamos apenas device_type_id -> device_types -> device_brands.

-- Remove índices e constraint que dependem de brand / device_type
drop index if exists device_models_brand_idx;
drop index if exists device_models_device_type_idx;
alter table public.device_models
  drop constraint if exists device_models_unique;

-- Garante unicidade por (device_type_id, model)
-- Primeiro, remove duplicados mantendo o menor id como "canônico"
delete from public.device_models dm
using public.device_models other
where dm.id > other.id
  and dm.device_type_id is not distinct from other.device_type_id
  and dm.model is not distinct from other.model;

create unique index if not exists device_models_type_model_unique
  on public.device_models(device_type_id, model);

-- Remove colunas antigas
alter table public.device_models
  drop column if exists brand,
  drop column if exists device_type;

