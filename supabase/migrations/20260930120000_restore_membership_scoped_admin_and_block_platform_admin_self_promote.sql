-- Restaura is_admin / is_staff_or_admin com escopo de membership
-- (reverte a regressão de 20260914120000 que tornava qualquer users.role=admin
-- em admin global) e impede que admin de tenant conceda ou revogue platform_admin.
-- Admins da organização continuam podendo alterar staff/user/admin/accountant/retailer.

create or replace function public.is_staff_or_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null
    and (
      public.is_platform_admin()
      or public.is_global_scope_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = public.current_organization_id()
          and m.role_in_org in ('admin', 'staff')
      )
    );
$$;

create or replace function public.is_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null
    and (
      public.is_platform_admin()
      or public.is_global_scope_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = public.current_organization_id()
          and m.role_in_org = 'admin'
      )
    );
$$;

grant execute on function public.is_staff_or_admin () to authenticated;
grant execute on function public.is_admin () to authenticated;

create or replace function public.prevent_non_admin_role_change ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- SQL Editor, migrações e service role sem JWT de utilizador.
  if auth.uid() is null then
    return new;
  end if;

  if new.role = 'platform_admin' or old.role = 'platform_admin' then
    if not public.is_platform_admin() then
      raise exception 'permission_denied';
    end if;
    return new;
  end if;

  if not (
    public.is_platform_admin()
    or public.is_admin()
  ) then
    raise exception 'permission_denied';
  end if;

  return new;
end;
$$;
