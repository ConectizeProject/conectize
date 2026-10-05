-- Cada conta Bling tem o próprio Client ID e Client Secret.
-- O índice antigo permitia só uma conexão Bling por organização.

drop index if exists public.hub_connections_org_platform_singleton_uidx;

create unique index if not exists hub_connections_org_platform_singleton_uidx
  on public.hub_connections (organization_id, platform_id)
  where platform_id is distinct from 'whatsapp_evolution'
    and platform_id is distinct from 'bling';
