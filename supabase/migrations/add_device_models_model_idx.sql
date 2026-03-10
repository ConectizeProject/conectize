-- Índice para ORDER BY model na listagem de device_models (seletor de aparelho)
create index if not exists device_models_model_idx on public.device_models(model);
