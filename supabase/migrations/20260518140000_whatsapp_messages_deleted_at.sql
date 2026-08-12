-- Mensagens apagadas no WhatsApp permanecem no portal (soft delete).

alter table public.whatsapp_messages
  add column if not exists deleted_at timestamptz;

create index if not exists whatsapp_messages_deleted_at_idx
  on public.whatsapp_messages (conversation_id, deleted_at)
  where deleted_at is not null;
