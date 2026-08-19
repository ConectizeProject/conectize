alter table public.organization_fiscal_profiles
  add column if not exists nfce_csc_id_homologacao text null,
  add column if not exists nfce_csc_ciphertext_homologacao text null,
  add column if not exists nfce_csc_id_producao text null,
  add column if not exists nfce_csc_ciphertext_producao text null;

comment on column public.organization_fiscal_profiles.nfce_csc_id_homologacao is
  'ID Token CSC da NFC-e no ambiente de homologação.';
comment on column public.organization_fiscal_profiles.nfce_csc_ciphertext_homologacao is
  'CSC da NFC-e de homologação (secreto).';
comment on column public.organization_fiscal_profiles.nfce_csc_id_producao is
  'ID Token CSC da NFC-e no ambiente de produção.';
comment on column public.organization_fiscal_profiles.nfce_csc_ciphertext_producao is
  'CSC da NFC-e de produção (secreto).';

update public.organization_fiscal_profiles
set
  nfce_csc_id_homologacao = coalesce(nfce_csc_id_homologacao, nfce_csc_id),
  nfce_csc_ciphertext_homologacao = coalesce(nfce_csc_ciphertext_homologacao, nfce_csc_ciphertext),
  nfce_csc_id_producao = coalesce(nfce_csc_id_producao, nfce_csc_id),
  nfce_csc_ciphertext_producao = coalesce(nfce_csc_ciphertext_producao, nfce_csc_ciphertext)
where nfce_csc_id is not null or nfce_csc_ciphertext is not null;
