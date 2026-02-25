-- Valor pelo qual o aparelho foi efetivamente vendido (diferente de sale_value_cents que é o valor varejo previsto)
alter table public.resale_devices add column if not exists sold_for_cents integer;
