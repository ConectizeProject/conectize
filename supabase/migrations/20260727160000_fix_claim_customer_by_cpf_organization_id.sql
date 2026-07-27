-- complete-profile: claim_customer_by_cpf ainda inseria customers sem organization_id
-- (coluna NOT NULL desde o multitenant).

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
  u_email text;
  org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  -- CPF pertence a 1 conta (users.cpf)
  if exists (
    select 1
    from public.users u
    where u.cpf = cpf_input
      and u.id <> auth.uid()
  ) then
    raise exception 'cpf_already_claimed';
  end if;

  -- Se já existe CPF na conta, não permite trocar por outro
  if exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.cpf is not null
      and u.cpf <> cpf_input
  ) then
    raise exception 'cpf_mismatch';
  end if;

  -- Garante users (e grava cpf/nome)
  insert into public.users (id, email, cpf, full_name)
  values (auth.uid(), u_email, cpf_input, name_input)
  on conflict (id)
  do update set
    email = coalesce(excluded.email, public.users.email),
    cpf = coalesce(public.users.cpf, excluded.cpf),
    full_name = coalesce(excluded.full_name, public.users.full_name);

  -- Organização: contexto ativo → membership → org host
  org_id := public.current_organization_id();

  if org_id is null then
    select m.organization_id
      into org_id
    from public.organization_members m
    where m.user_id = auth.uid()
    order by m.organization_id asc
    limit 1;
  end if;

  if org_id is null then
    select o.id
      into org_id
    from public.organizations o
    where o.is_host = true
    order by o.id asc
    limit 1;
  end if;

  if org_id is null then
    raise exception 'organization_required';
  end if;

  select id, auth_user_id
    into existing_id, existing_auth
  from public.customers
  where cpf = cpf_input;

  if existing_id is null then
    insert into public.customers (organization_id, cpf, full_name, email, auth_user_id)
    values (org_id, cpf_input, name_input, u_email, auth.uid())
    returning id into existing_id;

    return existing_id;
  end if;

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
end;
$$;

revoke all on function public.claim_customer_by_cpf(text, text) from public;
grant execute on function public.claim_customer_by_cpf(text, text) to authenticated;

comment on function public.claim_customer_by_cpf(text, text) is
  'Vincula CPF ao usuário autenticado; cria customers com organization_id (contexto, membership ou host).';
