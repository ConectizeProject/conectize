-- Inbox WhatsApp: Supabase Realtime (portal staff via RLS).
-- Após aplicar: Settings → Database → Replication deve listar as tabelas (ou via esta migration).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_conversations'
  ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;
end $$;

comment on table public.whatsapp_messages is
  'Mensagens inbound/outbound; Realtime para inbox do portal.';
