-- Admin global (users.role = 'admin') sem vínculo em organization_members:
-- passa a ter o mesmo efeito que platform_admin em is_staff_or_admin / is_admin
-- e pode listar organizations (fallback de org ativa no portal).

create or replace function public.is_global_scope_admin ()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
  and not exists (
    select 1
    from public.organization_members m
    where m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_global_scope_admin () from public;
grant execute on function public.is_global_scope_admin () to authenticated;

create or replace function public.is_staff_or_admin ()
returns boolean
language sql
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

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
  on public.organizations for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.is_global_scope_admin()
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );
