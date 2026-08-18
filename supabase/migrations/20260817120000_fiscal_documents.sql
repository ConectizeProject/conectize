-- Fiscal documents: NFC-e/NF-e direct emission with organization-scoped settings.

create table if not exists public.organization_fiscal_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  legal_name text null,
  trade_name text null,
  cnpj text null,
  state_registration text null,
  municipal_registration text null,
  tax_regime text not null default 'simples_nacional'
    check (tax_regime in ('simples_nacional', 'simples_excesso_sublimite', 'regime_normal')),
  street text null,
  number text null,
  complement text null,
  district text null,
  zip_code text null,
  city text null,
  state text null,
  ibge_city_code text null,
  nfce_csc_id text null,
  nfce_csc_ciphertext text null,
  nfce_series integer not null default 1 check (nfce_series > 0),
  nfce_next_number bigint not null default 1 check (nfce_next_number > 0),
  nfe_series integer not null default 1 check (nfe_series > 0),
  nfe_next_number bigint not null default 1 check (nfe_next_number > 0),
  fiscal_environment text not null default 'homologacao'
    check (fiscal_environment in ('homologacao', 'producao')),
  nfce_enabled boolean not null default false,
  default_cfop text not null default '5102',
  default_origin integer not null default 0 check (default_origin between 0 and 8),
  default_unit text not null default 'UN',
  default_csosn text not null default '102',
  default_pis_cst text not null default '49',
  default_cofins_cst text not null default '49',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_fiscal_certificates (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pfx_ciphertext text not null,
  password_ciphertext text not null,
  subject_common_name text null,
  subject_cnpj text null,
  valid_from timestamptz null,
  valid_until timestamptz null,
  fingerprint_sha256 text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  model text not null check (model in ('55', '65')),
  environment text not null check (environment in ('homologacao', 'producao')),
  series integer not null check (series > 0),
  number bigint not null check (number > 0),
  access_key text null,
  sales_order_id uuid null references public.sales_orders(id) on delete set null,
  service_order_id uuid null references public.service_orders(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'rejected', 'canceled', 'denied')),
  submitted_xml text null,
  authorized_xml text null,
  protocol text null,
  qr_code_url text null,
  sefaz_status_code text null,
  sefaz_status_message text null,
  authorized_at timestamptz null,
  canceled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_documents_unique_number unique (organization_id, model, environment, series, number),
  constraint fiscal_documents_one_source check (
    sales_order_id is not null or service_order_id is not null
  )
);

create unique index if not exists fiscal_documents_sales_order_nfce_uniq
  on public.fiscal_documents (organization_id, sales_order_id)
  where model = '65' and sales_order_id is not null and status <> 'canceled';

create index if not exists fiscal_documents_org_created_idx
  on public.fiscal_documents (organization_id, created_at desc);

create index if not exists fiscal_documents_org_status_idx
  on public.fiscal_documents (organization_id, status, created_at desc);

create table if not exists public.fiscal_document_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  event_type text not null check (event_type in ('submit', 'authorize', 'reject', 'cancel', 'retry', 'error')),
  status_code text null,
  status_message text null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists fiscal_document_events_doc_idx
  on public.fiscal_document_events (fiscal_document_id, created_at desc);

create index if not exists fiscal_document_events_org_idx
  on public.fiscal_document_events (organization_id, created_at desc);

alter table public.products add column if not exists ncm text null;
alter table public.products add column if not exists cest text null;
alter table public.products add column if not exists cfop text null;
alter table public.products add column if not exists fiscal_origin integer null check (fiscal_origin is null or fiscal_origin between 0 and 8);
alter table public.products add column if not exists fiscal_unit text null;
alter table public.products add column if not exists icms_csosn text null;
alter table public.products add column if not exists icms_cst text null;
alter table public.products add column if not exists pis_cst text null;
alter table public.products add column if not exists cofins_cst text null;

create index if not exists products_org_ncm_idx
  on public.products (organization_id, ncm)
  where ncm is not null;

create or replace function public.allocate_fiscal_document_number (
  p_organization_id uuid,
  p_model text,
  p_environment text
)
returns table(series integer, number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.organization_fiscal_profiles%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || p_model || ':' || p_environment));

  select *
  into profile_row
  from public.organization_fiscal_profiles
  where organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'missing_fiscal_profile';
  end if;

  if p_model = '65' then
    series := profile_row.nfce_series;
    number := profile_row.nfce_next_number;

    update public.organization_fiscal_profiles
    set nfce_next_number = nfce_next_number + 1,
        updated_at = now()
    where organization_id = p_organization_id;

    return next;
    return;
  end if;

  if p_model = '55' then
    series := profile_row.nfe_series;
    number := profile_row.nfe_next_number;

    update public.organization_fiscal_profiles
    set nfe_next_number = nfe_next_number + 1,
        updated_at = now()
    where organization_id = p_organization_id;

    return next;
    return;
  end if;

  raise exception 'invalid_fiscal_model';
end;
$$;

alter table public.organization_fiscal_profiles enable row level security;
alter table public.organization_fiscal_certificates enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_document_events enable row level security;

drop policy if exists organization_fiscal_profiles_staff_select on public.organization_fiscal_profiles;
create policy organization_fiscal_profiles_staff_select
  on public.organization_fiscal_profiles for select
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists organization_fiscal_profiles_admin_all on public.organization_fiscal_profiles;
create policy organization_fiscal_profiles_admin_all
  on public.organization_fiscal_profiles for all
  to authenticated
  using (public.is_admin() and organization_id = public.current_organization_id())
  with check (public.is_admin() and organization_id = public.current_organization_id());

drop policy if exists organization_fiscal_certificates_admin_meta on public.organization_fiscal_certificates;
create policy organization_fiscal_certificates_admin_meta
  on public.organization_fiscal_certificates for select
  to authenticated
  using (false);

drop policy if exists fiscal_documents_staff_select on public.fiscal_documents;
create policy fiscal_documents_staff_select
  on public.fiscal_documents for select
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists fiscal_documents_staff_insert on public.fiscal_documents;
create policy fiscal_documents_staff_insert
  on public.fiscal_documents for insert
  to authenticated
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists fiscal_documents_staff_update on public.fiscal_documents;
create policy fiscal_documents_staff_update
  on public.fiscal_documents for update
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id())
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists fiscal_document_events_staff_select on public.fiscal_document_events;
create policy fiscal_document_events_staff_select
  on public.fiscal_document_events for select
  to authenticated
  using (public.is_staff_or_admin() and organization_id = public.current_organization_id());

drop policy if exists fiscal_document_events_staff_insert on public.fiscal_document_events;
create policy fiscal_document_events_staff_insert
  on public.fiscal_document_events for insert
  to authenticated
  with check (public.is_staff_or_admin() and organization_id = public.current_organization_id());

grant select, insert, update, delete on public.organization_fiscal_profiles to postgres, service_role;
grant select, insert, update, delete on public.organization_fiscal_certificates to postgres, service_role;
grant select, insert, update on public.fiscal_documents to postgres, service_role;
grant select, insert on public.fiscal_document_events to postgres, service_role;
grant select, insert, update, delete on public.organization_fiscal_profiles to authenticated;
grant select, insert, update on public.fiscal_documents to authenticated;
grant select, insert on public.fiscal_document_events to authenticated;
grant execute on function public.allocate_fiscal_document_number(uuid, text, text) to authenticated, service_role;
