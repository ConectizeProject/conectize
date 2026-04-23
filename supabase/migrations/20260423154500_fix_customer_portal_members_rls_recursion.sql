-- Evita recursão de RLS entre customer_portal_members <-> customers.
-- A policy anterior de customer_portal_members lia customers diretamente;
-- policies de customers consultam customer_portal_members, gerando loop.

create or replace function public.customer_belongs_to_current_organization (p_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = public.current_organization_id()
  );
$$;

revoke all on function public.customer_belongs_to_current_organization (uuid) from public;
grant execute on function public.customer_belongs_to_current_organization (uuid) to authenticated;

drop policy if exists customer_portal_members_staff_admin_all on public.customer_portal_members;
create policy customer_portal_members_staff_admin_all
  on public.customer_portal_members for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.customer_belongs_to_current_organization(customer_portal_members.customer_id)
  )
  with check (
    public.is_staff_or_admin()
    and public.customer_belongs_to_current_organization(customer_portal_members.customer_id)
  );
