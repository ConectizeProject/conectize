-- Preferência de org no claim_customer_by_cpf:
-- 1) customer já existente com o CPF (mantém a org dele)
-- 2) membership não-host do usuário
-- 3) contexto ativo se o usuário for membro dessa org
-- 4) qualquer membership
-- 5) org host (último recurso)

create or replace function public.claim_customer_by_cpf (
  cpf_input text,
  name_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  existing_auth uuid;
  existing_org uuid;
  u_email text;
  org_id uuid;
  ctx_org uuid;
  v_host uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  if exists (
    select 1
    from public.users u
    where u.cpf = cpf_input
      and u.id <> auth.uid()
  ) then
    raise exception 'cpf_already_claimed';
  end if;

  if exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.cpf is not null
      and u.cpf <> cpf_input
  ) then
    raise exception 'cpf_mismatch';
  end if;

  insert into public.users (id, email, cpf, full_name)
  values (auth.uid(), u_email, cpf_input, name_input)
  on conflict (id)
  do update set
    email = coalesce(excluded.email, public.users.email),
    cpf = coalesce(public.users.cpf, excluded.cpf),
    full_name = coalesce(excluded.full_name, public.users.full_name);

  select id, auth_user_id, organization_id
    into existing_id, existing_auth, existing_org
  from public.customers
  where cpf = cpf_input;

  -- Já existe cliente com esse CPF: só vincula o auth (não troca de org).
  if existing_id is not null then
    if existing_auth is null then
      update public.customers
        set auth_user_id = auth.uid(),
            full_name = coalesce(name_input, full_name),
            email = coalesce(u_email, email)
      where id = existing_id;
      return existing_id;
    end if;

    if existing_auth = auth.uid() then
      update public.customers
        set full_name = coalesce(name_input, full_name),
            email = coalesce(u_email, email)
      where id = existing_id;
      return existing_id;
    end if;

    raise exception 'cpf_already_claimed';
  end if;

  select o.id into v_host
  from public.organizations o
  where o.is_host = true
  order by o.id asc
  limit 1;

  -- Preferir membership em org que NÃO é host (cadastro via link de OS / empresa).
  select m.organization_id
    into org_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and (v_host is null or m.organization_id <> v_host)
  order by m.organization_id asc
  limit 1;

  if org_id is null then
    ctx_org := public.current_organization_id();
    if ctx_org is not null and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid()
        and m.organization_id = ctx_org
    ) then
      org_id := ctx_org;
    end if;
  end if;

  if org_id is null then
    select m.organization_id
      into org_id
    from public.organization_members m
    where m.user_id = auth.uid()
    order by m.organization_id asc
    limit 1;
  end if;

  if org_id is null then
    org_id := v_host;
  end if;

  if org_id is null then
    raise exception 'organization_required';
  end if;

  insert into public.customers (organization_id, cpf, full_name, email, auth_user_id)
  values (org_id, cpf_input, name_input, u_email, auth.uid())
  returning id into existing_id;

  -- Alinha o contexto do portal à org do customer criado.
  insert into public.user_portal_context (user_id, active_organization_id)
  values (auth.uid(), org_id)
  on conflict (user_id) do update
    set active_organization_id = excluded.active_organization_id;

  return existing_id;
end;
$$;

revoke all on function public.claim_customer_by_cpf(text, text) from public;
grant execute on function public.claim_customer_by_cpf(text, text) to authenticated;

comment on function public.claim_customer_by_cpf(text, text) is
  'Vincula CPF ao usuário; cria customers na org correta (membership não-host preferida; host só como fallback).';
