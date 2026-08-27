-- Exclusão de rascunho/rejeitada (NF-e e NFC-e). Eventos já têm ON DELETE CASCADE.
grant delete on public.fiscal_documents to postgres, service_role, authenticated;

drop policy if exists fiscal_documents_staff_delete on public.fiscal_documents;
create policy fiscal_documents_staff_delete
  on public.fiscal_documents for delete
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());
