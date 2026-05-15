-- Atributos de variação (portal): chaves definidas no pai; valores por variação.
-- O nome exibido no catálogo continua em `products.name` (composto a partir dos atributos).

alter table public.products
  add column if not exists variation_attribute_keys jsonb not null default '[]'::jsonb,
  add column if not exists variation_attribute_values jsonb not null default '{}'::jsonb;

comment on column public.products.variation_attribute_keys is
  'Lista ordenada de nomes de atributo (ex.: ["tamanho","cor"]) no produto pai; variações usam para compor o título.';

comment on column public.products.variation_attribute_values is
  'Mapa atributo → valor (ex.: {"tamanho":"1 metro"}) nas linhas de variação; chaves alinhadas ao pai.';
