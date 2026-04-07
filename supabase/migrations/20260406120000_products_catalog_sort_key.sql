-- Ordenação estável do catálogo: pais (12 dígitos) e variações (pai.sufixo de 6 dígitos), ordenável em uma única coluna.
alter table public.products
  add column if not exists catalog_sort_key text;

create index if not exists products_catalog_sort_key_idx
  on public.products (catalog_sort_key);

-- Pais (raízes): ordem por data de criação
with parents as (
  select
    id,
    row_number() over (order by created_at asc) as rn
  from public.products
  where parent_bling_id is null
)
update public.products p
set catalog_sort_key = lpad(parents.rn::text, 12, '0')
from parents
where p.id = parents.id;

-- Variações: encadeadas ao pai (por bling_id do pai)
with ranked as (
  select
    c.id,
    p.catalog_sort_key as parent_key,
    row_number() over (
      partition by c.parent_bling_id
      order by c.created_at asc
    ) as rn
  from public.products c
  inner join public.products p
    on p.bling_id = c.parent_bling_id
    and p.parent_bling_id is null
  where c.parent_bling_id is not null
)
update public.products c
set catalog_sort_key = ranked.parent_key || '.' || lpad(ranked.rn::text, 6, '0')
from ranked
where c.id = ranked.id;

-- Órfãos (pai não encontrado pelo bling_id): tenta parent_product_id
with ranked as (
  select
    c.id,
    p.catalog_sort_key as parent_key,
    row_number() over (
      partition by c.parent_product_id
      order by c.created_at asc
    ) as rn
  from public.products c
  inner join public.products p on p.id = c.parent_product_id and p.parent_bling_id is null
  where c.parent_bling_id is not null
    and c.catalog_sort_key is null
)
update public.products c
set catalog_sort_key = ranked.parent_key || '.' || lpad(ranked.rn::text, 6, '0')
from ranked
where c.id = ranked.id;

comment on column public.products.catalog_sort_key is
  'Ordenação do catálogo: raiz = 12 dígitos (ex. 000000000001); variação = raiz + . + 6 dígitos (ex. 000000000002.000003).';
