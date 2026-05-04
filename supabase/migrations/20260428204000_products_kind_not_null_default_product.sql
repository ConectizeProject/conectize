-- Remove legado de products.kind nulo e padroniza default como 'product'.

update public.products
set kind = 'product'
where kind is null;

alter table public.products
  alter column kind set default 'product';

alter table public.products
  alter column kind set not null;

alter table public.products
  drop constraint if exists products_kind_check;

alter table public.products
  add constraint products_kind_check
    check (kind in ('product', 'service'));
