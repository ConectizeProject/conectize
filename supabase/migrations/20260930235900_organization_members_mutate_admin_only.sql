-- Staff não pode mais INSERT/UPDATE/DELETE em organization_members.
-- A policy FOR ALL anterior (is_staff_or_admin) permitia PATCH de
-- role_in_org=admin na própria membership e, com isso, requireFiscalAdmin
-- + download do certificado A1. Cadastro e gestão de usuários no portal
-- continuam via service_role / SECURITY DEFINER (auth.uid() is null).

drop policy if exists organization_members_mutate_staff on public.organization_members;
drop policy if exists organization_members_mutate_admin on public.organization_members;

create policy organization_members_mutate_admin
  on public.organization_members for all
  to authenticated
  using (
    public.is_admin()
    and organization_members.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and organization_members.organization_id = public.current_organization_id()
  );

create or replace function public.prevent_non_admin_org_role_escalation ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- SQL Editor, migrações e service role sem JWT de utilizador.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role_in_org = 'admin'
       and not (
         public.is_platform_admin()
         or public.is_admin()
       ) then
      raise exception 'permission_denied';
    end if;
    return new;
  end if;

  if new.role_in_org is not distinct from old.role_in_org then
    return new;
  end if;

  if (new.role_in_org = 'admin' or old.role_in_org = 'admin')
     and not (
       public.is_platform_admin()
       or public.is_admin()
     ) then
    raise exception 'permission_denied';
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_prevent_admin_escalation
  on public.organization_members;

create trigger organization_members_prevent_admin_escalation
before insert or update on public.organization_members
for each row execute function public.prevent_non_admin_org_role_escalation();
