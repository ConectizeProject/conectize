-- Alíquota média (%) usada no cálculo de margem de contribuição quando há NFC-e/NF-e autorizada.
alter table public.organization_fiscal_profiles
  add column if not exists margin_tax_percent numeric(5, 2) not null default 0;

alter table public.organization_fiscal_profiles
  drop constraint if exists organization_fiscal_profiles_margin_tax_percent_check;

alter table public.organization_fiscal_profiles
  add constraint organization_fiscal_profiles_margin_tax_percent_check
  check (margin_tax_percent >= 0 and margin_tax_percent <= 100);

comment on column public.organization_fiscal_profiles.margin_tax_percent is
  'Alíquota média (%) para estimativa de imposto na margem de vendas (NFC-e/NF-e autorizada).';
