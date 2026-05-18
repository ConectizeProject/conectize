-- Corrige índices únicos para upsert/sync (idempotente).
-- Rode no Supabase se sync falhar com erro de constraint ou ON CONFLICT.

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
