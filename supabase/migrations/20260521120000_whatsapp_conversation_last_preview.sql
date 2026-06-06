-- Preview da última mensagem na conversa (evita scan em whatsapp_messages na listagem).

alter table public.whatsapp_conversations
  add column if not exists last_message_preview text;

comment on column public.whatsapp_conversations.last_message_preview is
  'Trecho da última mensagem; mantido por trigger em whatsapp_messages.';

update public.whatsapp_conversations c
set last_message_preview = sub.preview
from (
  select distinct on (m.conversation_id)
    m.conversation_id,
    left(coalesce(m.body, ''), 280) as preview
  from public.whatsapp_messages m
  order by m.conversation_id, m.created_at desc
) sub
where c.id = sub.conversation_id
  and (c.last_message_preview is null or c.last_message_preview = '');

create or replace function public.trg_whatsapp_message_bump_conversation_preview ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_conversations
  set
    last_message_at = greatest(last_message_at, new.created_at),
    last_message_preview = left(coalesce(new.body, ''), 280),
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_bump_conv_preview on public.whatsapp_messages;
create trigger whatsapp_messages_bump_conv_preview
  after insert on public.whatsapp_messages
  for each row execute function public.trg_whatsapp_message_bump_conversation_preview ();
