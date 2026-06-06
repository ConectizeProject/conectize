-- Múltiplas instâncias Evolution por organização + conversas por conexão hub.

alter table public.hub_connections
  drop constraint if exists hub_connections_platform_id_key;

create unique index if not exists hub_connections_org_evolution_instance_uidx
  on public.hub_connections (
    organization_id,
    lower(trim(metadata->>'instance_name'))
  )
  where platform_id = 'whatsapp_evolution'
    and trim(coalesce(metadata->>'instance_name', '')) <> '';

alter table public.whatsapp_conversations
  add column if not exists hub_connection_id uuid references public.hub_connections (id) on delete set null;

drop index if exists public.whatsapp_conversations_org_wa_from_key;

create unique index if not exists whatsapp_conversations_org_hub_wa_from_key
  on public.whatsapp_conversations (organization_id, hub_connection_id, wa_from)
  where hub_connection_id is not null;

create unique index if not exists whatsapp_conversations_org_wa_from_legacy_key
  on public.whatsapp_conversations (organization_id, wa_from)
  where hub_connection_id is null;

create index if not exists whatsapp_conversations_hub_connection_id_idx
  on public.whatsapp_conversations (hub_connection_id);

-- Vincula conversas Evolution legadas à primeira conexão da org (se houver uma só).
update public.whatsapp_conversations w
set hub_connection_id = h.id
from public.hub_connections h
where w.hub_connection_id is null
  and w.organization_id = h.organization_id
  and h.platform_id = 'whatsapp_evolution'
  and not exists (
    select 1
    from public.hub_connections h2
    where h2.organization_id = h.organization_id
      and h2.platform_id = 'whatsapp_evolution'
      and h2.id <> h.id
  );
