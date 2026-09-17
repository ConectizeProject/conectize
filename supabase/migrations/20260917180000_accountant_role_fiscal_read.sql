-- Papel Contador: acesso read-only a notas fiscais da organização.

alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (
    role in ('user', 'staff', 'admin', 'retailer', 'platform_admin', 'accountant')
  );

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role_in_org in ('admin', 'staff', 'user', 'accountant'));

create or replace function public.is_accountant ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'accountant'
  );
$$;

grant execute on function public.is_accountant() to authenticated, service_role;

drop policy if exists fiscal_documents_accountant_select on public.fiscal_documents;
create policy fiscal_documents_accountant_select
  on public.fiscal_documents for select
  to authenticated
  using (
    public.is_accountant()
    and organization_id = public.current_organization_id()
  );

drop policy if exists fiscal_document_events_accountant_select on public.fiscal_document_events;
create policy fiscal_document_events_accountant_select
  on public.fiscal_document_events for select
  to authenticated
  using (
    public.is_accountant()
    and organization_id = public.current_organization_id()
  );
