-- Tamanho em disco das tabelas de WhatsApp (dados, toast e índices).
-- É a métrica que ocupa o banco. Não soma linha a linha, para não estourar o tempo da consulta.

create or replace function public.admin_whatsapp_messages_table_bytes()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return pg_total_relation_size('public.whatsapp_messages'::regclass)
    + pg_total_relation_size('public.whatsapp_conversations'::regclass);
end;
$$;

revoke all on function public.admin_whatsapp_messages_table_bytes() from public;
grant execute on function public.admin_whatsapp_messages_table_bytes() to authenticated;
grant execute on function public.admin_whatsapp_messages_table_bytes() to service_role;
