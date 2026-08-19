-- IBS/CBS defaults for NFC-e (NT 2025.002). Rates stay in code by year.

alter table public.organization_fiscal_profiles
  add column if not exists ibscbs_enabled boolean not null default false,
  add column if not exists ibscbs_cst text not null default '000',
  add column if not exists ibscbs_cclass_trib text not null default '000001';

alter table public.organization_fiscal_operation_natures
  add column if not exists ibscbs_enabled boolean not null default false,
  add column if not exists ibscbs_cst text not null default '000',
  add column if not exists ibscbs_cclass_trib text not null default '000001';

comment on column public.organization_fiscal_profiles.ibscbs_enabled is
  'When true, NFC-e XML includes the IBSCBS group. Simples is optional until 2027.';
comment on column public.organization_fiscal_profiles.ibscbs_cst is
  'CST IBS/CBS (3 digits). Pair must match cClassTrib.';
comment on column public.organization_fiscal_profiles.ibscbs_cclass_trib is
  'cClassTrib IBS/CBS (6 digits). First 3 digits equal CST.';
