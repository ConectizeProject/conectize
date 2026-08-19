-- Fiscal operation natures: simple defaults for NFC-e/NF-e emission.

create table if not exists public.organization_fiscal_operation_natures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_model text not null check (document_model in ('55', '65')),
  name text not null,
  description text not null,
  series integer not null default 1 check (series > 0),
  operation_type text not null default 'saida' check (operation_type in ('entrada', 'saida')),
  tax_regime text not null default 'simples_nacional'
    check (tax_regime in ('simples_nacional', 'simples_excesso_sublimite', 'regime_normal')),
  presence_indicator integer not null default 1 check (presence_indicator between 0 and 9),
  is_billed boolean not null default true,
  is_final_consumer boolean not null default true,
  is_return boolean not null default false,
  default_cfop text not null default '5102',
  default_origin integer not null default 0 check (default_origin between 0 and 8),
  default_unit text not null default 'UN',
  icms_csosn text null,
  icms_cst text null,
  pis_cst text not null default '49',
  cofins_cst text not null default '49',
  is_default boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_fiscal_operation_natures_default_uniq
  on public.organization_fiscal_operation_natures (organization_id, document_model)
  where is_default = true;

create index if not exists organization_fiscal_operation_natures_org_model_idx
  on public.organization_fiscal_operation_natures (organization_id, document_model, is_active);

alter table public.organization_fiscal_operation_natures enable row level security;

drop policy if exists organization_fiscal_operation_natures_staff_select on public.organization_fiscal_operation_natures;
create policy organization_fiscal_operation_natures_staff_select
  on public.organization_fiscal_operation_natures for select
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists organization_fiscal_operation_natures_admin_all on public.organization_fiscal_operation_natures;
create policy organization_fiscal_operation_natures_admin_all
  on public.organization_fiscal_operation_natures for all
  to authenticated
  using (public.is_admin() and organization_id = public.current_organization_id())
  with check (public.is_admin() and organization_id = public.current_organization_id());

grant select, insert, update, delete on public.organization_fiscal_operation_natures to postgres, service_role;
grant select, insert, update, delete on public.organization_fiscal_operation_natures to authenticated;
