-- Fecha o gadget is_global_scope_admin: um admin de tenant que apaga a própria
-- membership deixava de ter linhas em organization_members, is_admin() passava
-- a ser verdadeiro para qualquer current_organization_id, e user_portal_context
-- aceitava UUID de outra org. Com isso dava para inserir-se como admin na vítima
-- e ler hub_connections / certificado A1.
--
-- Admin sem membership deixa de herdar poder de platform_admin. Só
-- users.role = platform_admin troca de organização livremente.

create or replace function public.is_global_scope_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function public.user_can_activate_organization (p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_organization_id is not null
    and (
      public.is_platform_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = p_organization_id
      )
      or exists (
        select 1
        from public.customer_portal_members cpm
        join public.customers c on c.id = cpm.customer_id
        where cpm.user_id = auth.uid()
          and c.organization_id = p_organization_id
      )
    );
$$;

revoke all on function public.user_can_activate_organization (uuid) from public;
grant execute on function public.user_can_activate_organization (uuid) to authenticated;

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

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
  on public.organizations for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists user_portal_context_own on public.user_portal_context;
create policy user_portal_context_own
  on public.user_portal_context for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      active_organization_id is null
      or public.user_can_activate_organization(active_organization_id)
    )
  );
