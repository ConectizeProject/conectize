-- Adiciona coluna opcional de thumbnail para produtos

alter table public.products
  add column if not exists image_url text;

