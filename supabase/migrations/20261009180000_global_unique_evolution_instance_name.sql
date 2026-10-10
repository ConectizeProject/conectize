-- instance_name da Evolution era único só por organização. O webhook
-- resolve pelo nome global (findEvolutionHubByInstance), então dois tenants
-- podiam gravar o mesmo nome e o primeiro match recebia a inbox da vítima.
--
-- 1) Desambigua colisões existentes (mantém o mais antigo; os demais ganham
--    sufixo -dup-<id> para o índice único poder ser criado).
-- 2) Índice único global em lower(trim(instance_name)).

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(trim(metadata->>'instance_name'))
      order by created_at asc, id asc
    ) as rn
  from public.hub_connections
  where platform_id = 'whatsapp_evolution'
    and trim(coalesce(metadata->>'instance_name', '')) <> ''
)
update public.hub_connections h
set
  metadata = jsonb_set(
    coalesce(h.metadata, '{}'::jsonb),
    '{instance_name}',
    to_jsonb(
      trim(h.metadata->>'instance_name') || '-dup-' || substring(h.id::text, 1, 8)
    )
  ),
  updated_at = now()
from ranked r
where h.id = r.id
  and r.rn > 1;

drop index if exists public.hub_connections_evolution_instance_global_uidx;

create unique index hub_connections_evolution_instance_global_uidx
  on public.hub_connections (lower(trim(metadata->>'instance_name')))
  where platform_id = 'whatsapp_evolution'
    and trim(coalesce(metadata->>'instance_name', '')) <> '';
