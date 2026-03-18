-- Marca produtos vs serviços importados do Bling

alter table public.products
  add column if not exists kind text check (kind in ('product', 'service')) null;

create index if not exists products_kind_idx
  on public.products (kind);

