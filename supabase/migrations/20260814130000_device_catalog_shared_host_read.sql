-- Catálogo de aparelhos: leitura do host (Conectize) para todas as orgs;
-- escrita continua apenas na organização atual.

create or replace function public.host_organization_id ()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from public.organizations o
  where o.is_host = true
  order by o.created_at asc
  limit 1;
$$;

revoke all on function public.host_organization_id () from public;
grant execute on function public.host_organization_id () to authenticated;
grant execute on function public.host_organization_id () to service_role;

-- device_brands
drop policy if exists device_brands_staff_select_org on public.device_brands;
create policy device_brands_staff_select_org
  on public.device_brands for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and (
      device_brands.organization_id = public.current_organization_id()
      or device_brands.organization_id = public.host_organization_id()
    )
  );

drop policy if exists device_brands_retailer_select_org on public.device_brands;
create policy device_brands_retailer_select_org
  on public.device_brands for select
  to authenticated
  using (
    public.is_retailer()
    and (
      device_brands.organization_id = public.host_organization_id()
      or exists (
        select 1
        from public.customer_portal_members m
        join public.customers c on c.id = m.customer_id
        where m.user_id = auth.uid()
          and c.organization_id = device_brands.organization_id
      )
    )
  );

-- device_types
drop policy if exists device_types_staff_select_org on public.device_types;
create policy device_types_staff_select_org
  on public.device_types for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and (
      device_types.organization_id = public.current_organization_id()
      or device_types.organization_id = public.host_organization_id()
    )
  );

drop policy if exists device_types_retailer_select_org on public.device_types;
create policy device_types_retailer_select_org
  on public.device_types for select
  to authenticated
  using (
    public.is_retailer()
    and (
      device_types.organization_id = public.host_organization_id()
      or exists (
        select 1
        from public.customer_portal_members m
        join public.customers c on c.id = m.customer_id
        where m.user_id = auth.uid()
          and c.organization_id = device_types.organization_id
      )
    )
  );

-- device_models
drop policy if exists device_models_staff_select_org on public.device_models;
create policy device_models_staff_select_org
  on public.device_models for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and (
      device_models.organization_id = public.current_organization_id()
      or device_models.organization_id = public.host_organization_id()
    )
  );

drop policy if exists device_models_retailer_select_org on public.device_models;
create policy device_models_retailer_select_org
  on public.device_models for select
  to authenticated
  using (
    public.is_retailer()
    and (
      device_models.organization_id = public.host_organization_id()
      or exists (
        select 1
        from public.customer_portal_members m
        join public.customers c on c.id = m.customer_id
        where m.user_id = auth.uid()
          and c.organization_id = device_models.organization_id
      )
    )
  );
