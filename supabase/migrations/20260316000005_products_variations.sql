-- Adiciona suporte a variações de produtos (Bling)

alter table public.products
  add column if not exists parent_bling_id text,
  add column if not exists parent_product_id uuid references public.products(id);

create index if not exists products_parent_bling_id_idx
  on public.products (parent_bling_id);

