-- Garante que, ao excluir uma marca, sejam excluídos em cascata
-- os dispositivos (device_types) e os aparelhos (device_models).
-- device_types já referencia device_brands com ON DELETE CASCADE.
-- Aqui ajustamos device_models.device_type_id para ON DELETE CASCADE
-- em relação a device_types.

alter table public.device_models
  drop constraint if exists device_models_device_type_id_fkey;

alter table public.device_models
  add constraint device_models_device_type_id_fkey
    foreign key (device_type_id)
    references public.device_types(id)
    on delete cascade;

