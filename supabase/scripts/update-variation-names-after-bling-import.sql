-- Atualiza nomes de VARIAÇÕES que ficaram iguais ao nome do pai (import antigo).
--
-- Limitação: no banco não guardamos `caracteristicas` do Bling; não dá para montar por SQL
-- o texto exato "Cabo HDMI tamanho:1 metro" quando só existe o valor "1 metro" noutro campo.
-- Este script compõe um nome legível quando houver discriminador:
--   • nome do pai + espaço + SKU do filho (se SKU do filho ≠ SKU do pai), senão
--   • nome do pai + espaço + código de barras do filho (se ≠ do pai).
--
-- Para o título completo com tipo de variação vindo do Bling, use "Atualizar pelo Bling" ou reimporte.
--
-- Uso: rode o SELECT; se a coluna `nome_sugerido` estiver ok, rode o UPDATE dentro de uma transação.

-- ---------------------------------------------------------------------------
-- 1) Pré-visualização
-- ---------------------------------------------------------------------------
select
  c.id,
  c.organization_id,
  c.bling_id as variacao_bling_id,
  c.parent_bling_id,
  trim(c.name) as nome_atual_filho,
  trim(p.name) as nome_pai,
  nullif(trim(c.sku), '') as sku_filho,
  nullif(trim(p.sku), '') as sku_pai,
  nullif(trim(c.barcode), '') as barcode_filho,
  nullif(trim(p.barcode), '') as barcode_pai,
  case
    when nullif(trim(c.sku), '') is not null
      and trim(c.sku) is distinct from trim(p.sku)
      then trim(p.name) || ' ' || trim(c.sku)
    when nullif(trim(c.barcode), '') is not null
      and trim(c.barcode) is distinct from trim(p.barcode)
      then trim(p.name) || ' ' || trim(c.barcode)
    else null
  end as nome_sugerido
from public.products c
inner join public.products p
  on p.organization_id = c.organization_id
  and p.bling_id = c.parent_bling_id
where c.parent_bling_id is not null
  and c.bling_id is not null
  and p.bling_id is not null
  and lower(trim(c.name)) = lower(trim(p.name))
  and (
    (
      nullif(trim(c.sku), '') is not null
      and trim(c.sku) is distinct from trim(p.sku)
    )
    or (
      nullif(trim(c.barcode), '') is not null
      and trim(c.barcode) is distinct from trim(p.barcode)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Atualização (rode após validar; envolva em BEGIN … COMMIT se preferir)
-- ---------------------------------------------------------------------------
/*
begin;

update public.products c
set
  name = v.novo_nome,
  updated_at = now(),
  bling_sync_snapshot = jsonb_set(
    coalesce(c.bling_sync_snapshot, '{}'::jsonb),
    '{name}',
    to_jsonb(v.novo_nome),
    true
  )
from (
  select
    c2.id,
    case
      when nullif(trim(c2.sku), '') is not null
        and trim(c2.sku) is distinct from trim(p2.sku)
        then trim(p2.name) || ' ' || trim(c2.sku)
      else trim(p2.name) || ' ' || trim(c2.barcode)
    end as novo_nome
  from public.products c2
  inner join public.products p2
    on p2.organization_id = c2.organization_id
    and p2.bling_id = c2.parent_bling_id
  where c2.parent_bling_id is not null
    and c2.bling_id is not null
    and p2.bling_id is not null
    and lower(trim(c2.name)) = lower(trim(p2.name))
    and (
      (
        nullif(trim(c2.sku), '') is not null
        and trim(c2.sku) is distinct from trim(p2.sku)
      )
      or (
        nullif(trim(c2.barcode), '') is not null
        and trim(c2.barcode) is distinct from trim(p2.barcode)
      )
    )
) v
where c.id = v.id;

commit;
*/
