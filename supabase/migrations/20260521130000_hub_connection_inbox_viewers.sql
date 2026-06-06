-- Quem pode ver cada canal WhatsApp (hub_connection) na inbox do portal.
-- Sem linhas = todos staff/admin da organização; com linhas = somente usuários listados (+ admins da org).

create table if not exists public.hub_connection_inbox_viewers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hub_connection_id uuid not null references public.hub_connections (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint hub_connection_inbox_viewers_unique unique (hub_connection_id, user_id)
);

create index if not exists hub_connection_inbox_viewers_hub_idx
  on public.hub_connection_inbox_viewers (hub_connection_id);

create index if not exists hub_connection_inbox_viewers_user_idx
  on public.hub_connection_inbox_viewers (user_id);

comment on table public.hub_connection_inbox_viewers is
  'Allowlist de usuários que veem o canal na inbox WhatsApp. Vazio = toda a equipe staff/admin da org.';

create or replace function public.user_can_view_hub_connection_inbox (p_hub_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_staff_or_admin()
    and (
      p_hub_connection_id is null
      or public.is_platform_admin()
      or public.is_admin()
      or (
        exists (
          select 1
          from public.hub_connections h
          where h.id = p_hub_connection_id
            and h.organization_id = public.current_organization_id()
        )
        and (
          not exists (
            select 1
            from public.hub_connection_inbox_viewers v
            where v.hub_connection_id = p_hub_connection_id
          )
          or exists (
            select 1
            from public.hub_connection_inbox_viewers v
            where v.hub_connection_id = p_hub_connection_id
              and v.user_id = auth.uid()
          )
        )
      )
    );
$$;

revoke all on function public.user_can_view_hub_connection_inbox (uuid) from public;
grant execute on function public.user_can_view_hub_connection_inbox (uuid) to authenticated;

drop policy if exists whatsapp_conversations_staff_all on public.whatsapp_conversations;
create policy whatsapp_conversations_staff_all
  on public.whatsapp_conversations for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and whatsapp_conversations.organization_id = public.current_organization_id()
    and public.user_can_view_hub_connection_inbox(whatsapp_conversations.hub_connection_id)
  )
  with check (
    public.is_staff_or_admin()
    and whatsapp_conversations.organization_id = public.current_organization_id()
    and public.user_can_view_hub_connection_inbox(whatsapp_conversations.hub_connection_id)
  );

drop policy if exists whatsapp_messages_staff_all on public.whatsapp_messages;
create policy whatsapp_messages_staff_all
  on public.whatsapp_messages for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.whatsapp_conversations wc
      where wc.id = whatsapp_messages.conversation_id
        and wc.organization_id = public.current_organization_id()
        and public.user_can_view_hub_connection_inbox(wc.hub_connection_id)
    )
  )
  with check (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.whatsapp_conversations wc
      where wc.id = whatsapp_messages.conversation_id
        and wc.organization_id = public.current_organization_id()
        and public.user_can_view_hub_connection_inbox(wc.hub_connection_id)
    )
  );

alter table public.hub_connection_inbox_viewers enable row level security;

drop policy if exists hub_connection_inbox_viewers_select on public.hub_connection_inbox_viewers;
create policy hub_connection_inbox_viewers_select
  on public.hub_connection_inbox_viewers for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_staff_or_admin()
  );

drop policy if exists hub_connection_inbox_viewers_admin_write on public.hub_connection_inbox_viewers;
create policy hub_connection_inbox_viewers_admin_write
  on public.hub_connection_inbox_viewers for all
  to authenticated
  using (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.hub_connections h
      where h.id = hub_connection_inbox_viewers.hub_connection_id
        and h.organization_id = public.current_organization_id()
    )
  );

grant select, insert, update, delete on public.hub_connection_inbox_viewers to postgres, service_role, authenticated;
