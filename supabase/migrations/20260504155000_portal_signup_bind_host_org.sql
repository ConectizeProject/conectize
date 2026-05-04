-- Garante vínculo automático de novos cadastros (/portal/cadastro)
-- com a organização host Conectize + backfill de usuários sem vínculo.

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id)
  do update set email = excluded.email;

  insert into public.organization_members (organization_id, user_id, role_in_org)
  values (v_host, new.id, 'user')
  on conflict (organization_id, user_id) do nothing;

  insert into public.user_portal_context (user_id, active_organization_id)
  values (new.id, v_host)
  on conflict (user_id) do update
    set active_organization_id = coalesce(public.user_portal_context.active_organization_id, excluded.active_organization_id);

  return new;
end;
$$;

do $$
declare
  v_host uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  -- Usuários já existentes sem membership em nenhuma organização
  -- passam a pertencer à org host, exceto lojistas.
  insert into public.organization_members (organization_id, user_id, role_in_org)
  select
    v_host,
    u.id,
    case
      when u.role = 'admin' then 'admin'::text
      when u.role = 'staff' then 'staff'::text
      else 'user'::text
    end
  from public.users u
  where u.role <> 'retailer'
    and not exists (
      select 1
      from public.organization_members m
      where m.user_id = u.id
    )
  on conflict (organization_id, user_id) do nothing;

  insert into public.user_portal_context (user_id, active_organization_id)
  select u.id, v_host
  from public.users u
  where u.role <> 'retailer'
    and not exists (
      select 1
      from public.user_portal_context c
      where c.user_id = u.id
    )
  on conflict (user_id) do nothing;

  update public.user_portal_context c
  set active_organization_id = v_host
  from public.users u
  where u.id = c.user_id
    and u.role <> 'retailer'
    and c.active_organization_id is null;
end $$;
