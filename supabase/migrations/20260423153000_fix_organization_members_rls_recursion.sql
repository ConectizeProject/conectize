-- Evita recursão infinita de RLS em organization_members:
-- a policy anterior consultava a própria tabela com EXISTS.
-- Isso quebrava leituras de users/portal com:
-- "infinite recursion detected in policy for relation organization_members".

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select
  on public.organization_members for select
  to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or (
      organization_members.organization_id = public.current_organization_id()
      and public.is_staff_or_admin()
    )
  );
