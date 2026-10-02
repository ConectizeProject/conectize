-- is_accountant() só olhava users.role = accountant. Com um
-- user_portal_context antigo apontando para outra org (ou qualquer
-- bypass futuro de user_can_activate_organization), as policies
-- fiscal_documents_accountant_select / fiscal_document_events_accountant_select
-- liberavam XML fiscal cruzado.
--
-- A troca livre de org já foi fechada em 20261001180000. Este passo
-- alinha o helper ao membership, como is_staff_or_admin / is_admin.

create or replace function public.is_accountant ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid()
        and m.organization_id = public.current_organization_id()
        and m.role_in_org = 'accountant'
    );
$$;

revoke all on function public.is_accountant () from public;
grant execute on function public.is_accountant () to authenticated, service_role;
