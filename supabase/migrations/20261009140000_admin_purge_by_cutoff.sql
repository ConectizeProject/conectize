-- Exclusão em uma instrução, com tempo maior que o limite padrão de 8s.
-- p_before nulo apaga todos os registros da organização.

create or replace function public.admin_purge_integration_webhooks(
  p_organization_id uuid,
  p_before timestamptz default null,
  p_platform text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare
  deleted_count bigint;
  platform_filter text;
begin
  if p_organization_id is null then
    raise exception 'organization_required';
  end if;

  if auth.role() is distinct from 'service_role' then
    if not public.is_admin() then
      raise exception 'forbidden';
    end if;
    if p_organization_id is distinct from public.current_organization_id()
       and not public.is_platform_admin() then
      raise exception 'forbidden';
    end if;
  end if;

  platform_filter := nullif(btrim(coalesce(p_platform, '')), '');
  if platform_filter = 'all' then
    platform_filter := null;
  end if;

  with deleted as (
    delete from public.integration_webhooks w
    where w.organization_id = p_organization_id
      and (platform_filter is null or w.platform_id = platform_filter)
      and (p_before is null or w.created_at <= p_before)
    returning 1
  )
  select count(*)::bigint into deleted_count from deleted;

  return deleted_count;
end;
$$;

revoke all on function public.admin_purge_integration_webhooks(uuid, timestamptz, text) from public;
grant execute on function public.admin_purge_integration_webhooks(uuid, timestamptz, text) to authenticated;
grant execute on function public.admin_purge_integration_webhooks(uuid, timestamptz, text) to service_role;

create or replace function public.admin_purge_whatsapp_messages(
  p_organization_id uuid,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
set statement_timeout = '120s'
as $$
declare
  deleted_messages bigint;
  deleted_conversations bigint;
begin
  if p_organization_id is null then
    raise exception 'organization_required';
  end if;

  if auth.role() is distinct from 'service_role' then
    if not public.is_admin() then
      raise exception 'forbidden';
    end if;
    if p_organization_id is distinct from public.current_organization_id()
       and not public.is_platform_admin() then
      raise exception 'forbidden';
    end if;
  end if;

  delete from storage.objects o
  where o.bucket_id = 'whatsapp-media'
    and o.name in (
      select btrim(m.payload #>> '{media,storage_path}')
      from public.whatsapp_messages m
      join public.whatsapp_conversations c on c.id = m.conversation_id
      where c.organization_id = p_organization_id
        and nullif(btrim(m.payload #>> '{media,storage_path}'), '') is not null
        and (p_before is null or m.created_at <= p_before)
    );

  with deleted as (
    delete from public.whatsapp_messages m
    using public.whatsapp_conversations c
    where m.conversation_id = c.id
      and c.organization_id = p_organization_id
      and (p_before is null or m.created_at <= p_before)
    returning 1
  )
  select count(*)::bigint into deleted_messages from deleted;

  with deleted as (
    delete from public.whatsapp_conversations c
    where c.organization_id = p_organization_id
      and not exists (
        select 1
        from public.whatsapp_messages m
        where m.conversation_id = c.id
      )
    returning 1
  )
  select count(*)::bigint into deleted_conversations from deleted;

  return jsonb_build_object(
    'messages', deleted_messages,
    'conversations', deleted_conversations
  );
end;
$$;

revoke all on function public.admin_purge_whatsapp_messages(uuid, timestamptz) from public;
grant execute on function public.admin_purge_whatsapp_messages(uuid, timestamptz) to authenticated;
grant execute on function public.admin_purge_whatsapp_messages(uuid, timestamptz) to service_role;
