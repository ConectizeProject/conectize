-- Rode no SQL Editor (Studio local ou Supabase Cloud) para confirmar se as migrations aplicaram.
-- Esperado após 20260520120000 + 20260520130000:

-- 1) Histórico de migrations (Supabase CLI grava aqui)
select version, name
from supabase_migrations.schema_migrations
where version >= '20260516120000'
order by version desc;

-- 2) Realtime nas tabelas WhatsApp
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('whatsapp_messages', 'whatsapp_conversations');

-- 3) Bucket de mídia
select id, name, public, file_size_limit
from storage.buckets
where id = 'whatsapp-media';

-- 4) Coluna deleted_at (migration anterior)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'whatsapp_messages'
  and column_name = 'deleted_at';

-- 5) Permissões por canal (20260521130000)
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'hub_connection_inbox_viewers'
) as hub_connection_inbox_viewers_table;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'whatsapp_conversations'
  and column_name = 'last_message_preview';

-- 6) Relay /pix removido (20260715211500) — tabela não deve existir
select not exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'whatsapp_pix_relay_pending'
) as whatsapp_pix_relay_pending_dropped;

-- 7) Múltiplas instâncias Evolution (20260521150000)
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'hub_connections'
  and indexname in (
    'hub_connections_org_evolution_instance_uidx',
    'hub_connections_org_platform_singleton_uidx'
  )
order by indexname;

select conname
from pg_constraint
where conrelid = 'public.hub_connections'::regclass
  and conname = 'hub_connections_platform_user_uniq';
