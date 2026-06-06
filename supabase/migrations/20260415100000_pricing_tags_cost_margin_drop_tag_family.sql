-- Tags: remove família redundante na tag; sugerido ao consumidor passa a usar custo + margem sobre a receita.

alter table public.pricing_tags
  drop constraint if exists pricing_tags_parts_family_check;

alter table public.pricing_tags
  drop column if exists parts_family;

comment on column public.pricing_tags.margin_bps is
  'Bps da margem de participação sobre o preço de venda final: (preço - custo) / preço = margin_bps/10_000; '
  'preço sugerido = arredondar_para_cima(custo * 10000 / (10000 - margin_bps)).';

-- Função portal_retailer_catalog_prices: recriada em 20260416120000_drop_products_parts_family.sql.
-- Não recriar aqui — CREATE OR REPLACE falha no cloud (42P13) se o tipo de retorno já foi atualizado.
