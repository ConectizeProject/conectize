-- Permite várias instâncias whatsapp_evolution por organização (uma por instance_name).
-- Remove índice/constraint legado que limitava a uma conexão por (org, platform_id).

alter table public.hub_connections
  drop constraint if exists hub_connections_platform_user_uniq;

drop index if exists public.hub_connections_platform_user_uniq;

alter table public.hub_connections
  drop constraint if exists hub_connections_platform_id_key;

-- Bling, Cloud API, ChatGPT etc.: no máximo uma conexão por plataforma na org.
create unique index if not exists hub_connections_org_platform_singleton_uidx
  on public.hub_connections (organization_id, platform_id)
  where platform_id is distinct from 'whatsapp_evolution';

-- Evolution: várias instâncias, nome único por org.
create unique index if not exists hub_connections_org_evolution_instance_uidx
  on public.hub_connections (
    organization_id,
    lower(trim(metadata->>'instance_name'))
  )
  where platform_id = 'whatsapp_evolution'
    and trim(coalesce(metadata->>'instance_name', '')) <> '';
