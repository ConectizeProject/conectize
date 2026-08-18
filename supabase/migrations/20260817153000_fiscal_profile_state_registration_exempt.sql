alter table public.organization_fiscal_profiles
  add column if not exists state_registration_exempt boolean not null default false;
