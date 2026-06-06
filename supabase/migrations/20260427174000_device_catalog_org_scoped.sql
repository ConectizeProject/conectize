-- Catálogo de dispositivos por organização:
-- - remove leitura global
-- - permite escrita de staff/admin na organização atual (não só host)
-- - mantém leitura de lojista vinculada à sua organização

alter table public.device_brands
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.device_types
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.device_models
  add column if not exists organization_id uuid references public.organizations (id);

do $$
declare
  v_host uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  update public.device_brands set organization_id = v_host where organization_id is null;
  update public.device_types set organization_id = v_host where organization_id is null;
  update public.device_models set organization_id = v_host where organization_id is null;
end $$;

alter table public.device_brands alter column organization_id set not null;
alter table public.device_types alter column organization_id set not null;
alter table public.device_models alter column organization_id set not null;

drop index if exists device_brands_name_idx;
drop index if exists device_types_brand_id_idx;
drop index if exists device_types_name_idx;

alter table public.device_brands
  drop constraint if exists device_brands_name_key;
alter table public.device_types
  drop constraint if exists device_types_brand_name_unique;
alter table public.device_models
  drop constraint if exists device_models_device_type_model_unique;

create unique index if not exists device_brands_org_name_unique
  on public.device_brands (organization_id, name);

create unique index if not exists device_types_org_brand_name_unique
  on public.device_types (organization_id, brand_id, name);

create unique index if not exists device_models_org_type_model_unique
  on public.device_models (organization_id, device_type_id, model);

create index if not exists device_brands_org_idx on public.device_brands (organization_id);
create index if not exists device_types_org_idx on public.device_types (organization_id);
create index if not exists device_models_org_idx on public.device_models (organization_id);

drop policy if exists device_models_select_authenticated on public.device_models;
drop policy if exists device_models_write_host_staff on public.device_models;
drop policy if exists device_models_retailer_select on public.device_models;
drop policy if exists device_models_staff_select_org on public.device_models;
drop policy if exists device_models_staff_write_org on public.device_models;
drop policy if exists device_models_retailer_select_org on public.device_models;

create policy device_models_staff_select_org
  on public.device_models for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_models.organization_id = public.current_organization_id()
  );

create policy device_models_staff_write_org
  on public.device_models for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_models.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and device_models.organization_id = public.current_organization_id()
  );

create policy device_models_retailer_select_org
  on public.device_models for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = device_models.organization_id
    )
  );

drop policy if exists device_brands_select_authenticated on public.device_brands;
drop policy if exists device_brands_write_host_staff on public.device_brands;
drop policy if exists device_brands_retailer_select on public.device_brands;
drop policy if exists device_brands_staff_select_org on public.device_brands;
drop policy if exists device_brands_staff_write_org on public.device_brands;
drop policy if exists device_brands_retailer_select_org on public.device_brands;

create policy device_brands_staff_select_org
  on public.device_brands for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_brands.organization_id = public.current_organization_id()
  );

create policy device_brands_staff_write_org
  on public.device_brands for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_brands.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and device_brands.organization_id = public.current_organization_id()
  );

create policy device_brands_retailer_select_org
  on public.device_brands for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = device_brands.organization_id
    )
  );

drop policy if exists device_types_select_authenticated on public.device_types;
drop policy if exists device_types_write_host_staff on public.device_types;
drop policy if exists device_types_retailer_select on public.device_types;
drop policy if exists device_types_staff_select_org on public.device_types;
drop policy if exists device_types_staff_write_org on public.device_types;
drop policy if exists device_types_retailer_select_org on public.device_types;

create policy device_types_staff_select_org
  on public.device_types for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_types.organization_id = public.current_organization_id()
  );

create policy device_types_staff_write_org
  on public.device_types for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and device_types.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and device_types.organization_id = public.current_organization_id()
  );

create policy device_types_retailer_select_org
  on public.device_types for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = device_types.organization_id
    )
  );
