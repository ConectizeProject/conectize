alter table public.products
  add column if not exists fci text null;

comment on column public.products.fci is
  'Número FCI (UUID) exigido pela SEFAZ para origens 3, 5 e 8.';
