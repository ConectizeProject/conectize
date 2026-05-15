-- Migra um produto PAI + VARIAÇÕES para o modelo de atributos do portal:
--   • Pai: `variation_attribute_keys` = ["Modelo"] (ajuste o JSON)
--   • Filhos: `variation_attribute_values` = {"Modelo": "<valor>"} extraído do nome atual
--   • Nome exibido: «Nome do pai Modelo:valor» (igual a `composePortalVariationDisplayName` na app)
--
-- Caso de exemplo: Pai "Bateria Samsung", filho "Bateria Samsung Modelo:S6"
--   → atributo Modelo, valor S6, nome final "Bateria Samsung Modelo:S6"
--
-- ANTES DE RODAR: ajuste os literais em `params` (nome do pai, chave do atributo, regex no nome do filho).
-- Rode o SELECT de pré-visualização; depois descomente o bloco UPDATE dentro de BEGIN … COMMIT.

-- ---------------------------------------------------------------------------
-- Parâmetros (edite aqui)
-- ---------------------------------------------------------------------------
with params as (
  select
    'Bateria Samsung'::text as parent_name_exact,
    'Modelo'::text as attr_key,
    -- Padrão no nome do filho (valor após «Modelo:»). Case-insensitive via flag em regexp_match / ~*.
    'Modelo\s*:\s*(.+)$'::text as child_value_regex
),
parent_row as (
  select
    p.id,
    p.organization_id,
    trim(p.name) as name,
    p.bling_id
  from public.products p
  cross join params pa
  where trim(p.name) = pa.parent_name_exact
    and p.parent_product_id is null
  limit 1
),
children as (
  select distinct c.id, c.name, c.organization_id, c.bling_sync_snapshot
  from public.products c
  cross join params pa
  join parent_row p on c.organization_id = p.organization_id
  where (
      c.parent_product_id = p.id
      or (
        p.bling_id is not null
        and nullif(trim(c.parent_bling_id::text), '') is not null
        and trim(c.parent_bling_id::text) = trim(p.bling_id::text)
      )
    )
    and trim(c.name) ~* pa.child_value_regex
)
-- ---------------------------------------------------------------------------
-- Pré-visualização (rode primeiro)
-- ---------------------------------------------------------------------------
select
  'parent'::text as row_kind,
  pr.id,
  pr.organization_id,
  pr.name as nome_atual,
  jsonb_build_array(pa.attr_key)::text as novo_variation_attribute_keys,
  null::text as novo_valor_extraido,
  null::text as novo_name_filho
from parent_row pr
cross join params pa
union all
select
  'child'::text,
  c.id,
  c.organization_id,
  trim(c.name) as nome_atual,
  null,
  nullif(
    trim((regexp_match(trim(c.name), pa.child_value_regex, 'i'))[1]),
    ''
  ) as novo_valor_extraido,
  trim(pr.name)
    || ' '
    || pa.attr_key
    || ':'
    || nullif(
      trim((regexp_match(trim(c.name), pa.child_value_regex, 'i'))[1]),
      ''
    ) as novo_name_filho
from children c
cross join params pa
join parent_row pr on true;

/*
-- ---------------------------------------------------------------------------
-- Aplicar (descomente, revise o SELECT acima, rode numa transação)
-- ---------------------------------------------------------------------------
begin;

with params as (
  select
    'Bateria Samsung'::text as parent_name_exact,
    'Modelo'::text as attr_key,
    'Modelo\s*:\s*(.+)$'::text as child_value_regex
),
parent_row as (
  select p.id, p.organization_id, trim(p.name) as name, p.bling_id
  from public.products p
  cross join params pa
  where trim(p.name) = pa.parent_name_exact
    and p.parent_product_id is null
  limit 1
),
children as (
  select distinct c.id, c.name, c.organization_id, c.bling_sync_snapshot
  from public.products c
  cross join params pa
  join parent_row p on c.organization_id = p.organization_id
  where (
      c.parent_product_id = p.id
      or (
        p.bling_id is not null
        and nullif(trim(c.parent_bling_id::text), '') is not null
        and trim(c.parent_bling_id::text) = trim(p.bling_id::text)
      )
    )
    and trim(c.name) ~* pa.child_value_regex
)
update public.products p
set
  variation_attribute_keys = jsonb_build_array(pa.attr_key),
  updated_at = now()
from parent_row pr
cross join params pa
where p.id = pr.id;

with params as (
  select
    'Bateria Samsung'::text as parent_name_exact,
    'Modelo'::text as attr_key,
    'Modelo\s*:\s*(.+)$'::text as child_value_regex
),
parent_row as (
  select p.id, p.organization_id, trim(p.name) as name, p.bling_id
  from public.products p
  cross join params pa
  where trim(p.name) = pa.parent_name_exact
    and p.parent_product_id is null
  limit 1
),
children as (
  select distinct c.id, c.name
  from public.products c
  cross join params pa
  join parent_row p on c.organization_id = p.organization_id
  where (
      c.parent_product_id = p.id
      or (
        p.bling_id is not null
        and nullif(trim(c.parent_bling_id::text), '') is not null
        and trim(c.parent_bling_id::text) = trim(p.bling_id::text)
      )
    )
    and trim(c.name) ~* pa.child_value_regex
),
parsed as (
  select
    c.id,
    nullif(trim((regexp_match(trim(c.name), pa.child_value_regex, 'i'))[1]), '') as val
  from children c
  cross join params pa
)
update public.products c
set
  variation_attribute_values = jsonb_build_object(pa.attr_key, p.val),
  name = trim(pr.name) || ' ' || pa.attr_key || ':' || p.val,
  updated_at = now(),
  bling_sync_snapshot = jsonb_set(
    coalesce(c.bling_sync_snapshot, '{}'::jsonb),
    '{name}',
    to_jsonb(trim(pr.name) || ' ' || pa.attr_key || ':' || p.val),
    true
  )
from parsed p
cross join params pa
join parent_row pr on true
where c.id = p.id
  and p.val is not null;

commit;
*/
