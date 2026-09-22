-- =============================================================================
-- Repara atributos de variação em massa (toda a organização ou um pai).
-- Formato alvo: «Nome do pai Modelo:valor» (ex.: Display iPhone Modelo:16 Pro Max)
--
-- 1) Rode o SELECT de pré-visualização.
-- 2) Se estiver ok, rode o bloco APPLY dentro de BEGIN … COMMIT.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Pré-visualização: pais sem keys + filhos (com ou sem «Modelo:» no nome)
-- ---------------------------------------------------------------------------
with parents as (
  select
    p.id,
    p.organization_id,
    trim(p.name) as name,
    p.bling_id,
    coalesce(p.variation_attribute_keys, '[]'::jsonb) as keys
  from public.products p
  where p.parent_product_id is null
    and (
      p.parent_bling_id is null
      or nullif(trim(p.parent_bling_id::text), '') is null
    )
    -- and p.organization_id = '00000000-0000-0000-0000-000000000000'::uuid
),
children as (
  select
    c.id,
    c.organization_id,
    trim(c.name) as name,
    c.parent_product_id,
    c.parent_bling_id,
    pr.id as resolved_parent_id,
    pr.name as parent_name
  from public.products c
  join parents pr
    on c.organization_id = pr.organization_id
   and (
     c.parent_product_id = pr.id
     or (
       pr.bling_id is not null
       and nullif(trim(c.parent_bling_id::text), '') is not null
       and trim(c.parent_bling_id::text) = trim(pr.bling_id::text)
     )
   )
),
parsed as (
  select
    c.*,
    case
      when c.name ~* ('^' || regexp_replace(c.parent_name, '([\\.^$|?*+(){}\\[\\]])', '\\\\\\1', 'g') || '\\s+.+')
        then trim(regexp_replace(c.name, '^' || regexp_replace(c.parent_name, '([\\.^$|?*+(){}\\[\\]])', '\\\\\\1', 'g') || '\\s+', '', 'i'))
      else c.name
    end as tail
  from children c
),
extracted as (
  select
    p.*,
    case
      when p.tail ~* '^[^:]+:\\s*.+'
        then nullif(trim((regexp_match(p.tail, '^([^:]+):\\s*(.+)$', 'i'))[1]), '')
      else 'Modelo'
    end as attr_key,
    case
      when p.tail ~* '^[^:]+:\\s*.+'
        then nullif(trim((regexp_match(p.tail, '^([^:]+):\\s*(.+)$', 'i'))[2]), '')
      else nullif(trim(p.tail), '')
    end as attr_val
  from parsed p
)
select
  e.resolved_parent_id,
  e.parent_name,
  e.id as child_id,
  e.name as nome_atual,
  initcap(lower(e.attr_key)) as attr_key_sugerido,
  e.attr_val as valor_sugerido,
  trim(e.parent_name) || ' ' || initcap(lower(coalesce(e.attr_key, 'Modelo'))) || ':' || e.attr_val as nome_sugerido
from extracted e
where e.attr_val is not null
order by e.parent_name, e.name;

/*
-- ---------------------------------------------------------------------------
-- APPLY — descomente após validar o SELECT
-- ---------------------------------------------------------------------------
begin;

-- 1) Pai: variation_attribute_keys = ["Modelo"] quando vazio e há filhos
with parents as (
  select p.id, p.organization_id, trim(p.name) as name, p.bling_id
  from public.products p
  where p.parent_product_id is null
    and (
      p.parent_bling_id is null
      or nullif(trim(p.parent_bling_id::text), '') is null
    )
    and (
      p.variation_attribute_keys is null
      or p.variation_attribute_keys = '[]'::jsonb
    )
),
with_children as (
  select distinct pr.id
  from parents pr
  join public.products c
    on c.organization_id = pr.organization_id
   and (
     c.parent_product_id = pr.id
     or (
       pr.bling_id is not null
       and nullif(trim(c.parent_bling_id::text), '') is not null
       and trim(c.parent_bling_id::text) = trim(pr.bling_id::text)
     )
   )
)
update public.products p
set
  variation_attribute_keys = '["Modelo"]'::jsonb,
  updated_at = now()
from with_children w
where p.id = w.id;

-- 2) Filhos: valores + nome composto
with parents as (
  select
    p.id,
    p.organization_id,
    trim(p.name) as name,
    p.bling_id,
    coalesce(p.variation_attribute_keys, '["Modelo"]'::jsonb) as keys
  from public.products p
  where p.parent_product_id is null
    and (
      p.parent_bling_id is null
      or nullif(trim(p.parent_bling_id::text), '') is null
    )
),
children as (
  select
    c.id,
    trim(c.name) as name,
    pr.id as parent_id,
    pr.name as parent_name,
    coalesce(pr.keys ->> 0, 'Modelo') as attr_key
  from public.products c
  join parents pr
    on c.organization_id = pr.organization_id
   and (
     c.parent_product_id = pr.id
     or (
       pr.bling_id is not null
       and nullif(trim(c.parent_bling_id::text), '') is not null
       and trim(c.parent_bling_id::text) = trim(pr.bling_id::text)
     )
   )
),
parsed as (
  select
    c.*,
    case
      when c.name ~* ('^' || regexp_replace(c.parent_name, '([\\.^$|?*+(){}\\[\\]])', '\\\\\\1', 'g') || '\\s+.+')
        then trim(regexp_replace(c.name, '^' || regexp_replace(c.parent_name, '([\\.^$|?*+(){}\\[\\]])', '\\\\\\1', 'g') || '\\s+', '', 'i'))
      else c.name
    end as tail
  from children c
),
extracted as (
  select
    p.*,
    case
      when p.tail ~* '^[^:]+:\\s*.+'
        then nullif(trim((regexp_match(p.tail, '^([^:]+):\\s*(.+)$', 'i'))[2]), '')
      else nullif(trim(p.tail), '')
    end as attr_val
  from parsed p
)
update public.products c
set
  variation_attribute_values = jsonb_build_object(e.attr_key, e.attr_val),
  name = trim(e.parent_name) || ' ' || e.attr_key || ':' || e.attr_val,
  updated_at = now(),
  bling_sync_snapshot = jsonb_set(
    coalesce(c.bling_sync_snapshot, '{}'::jsonb),
    '{name}',
    to_jsonb(trim(e.parent_name) || ' ' || e.attr_key || ':' || e.attr_val),
    true
  )
from extracted e
where c.id = e.id
  and e.attr_val is not null;

commit;
*/
