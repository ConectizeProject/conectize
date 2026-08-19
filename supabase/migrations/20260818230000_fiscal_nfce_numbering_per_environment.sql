alter table public.organization_fiscal_profiles
  add column if not exists nfce_series_homologacao integer,
  add column if not exists nfce_next_number_homologacao bigint,
  add column if not exists nfce_series_producao integer,
  add column if not exists nfce_next_number_producao bigint;

comment on column public.organization_fiscal_profiles.nfce_series_homologacao is
  'Série da NFC-e no ambiente de homologação.';
comment on column public.organization_fiscal_profiles.nfce_next_number_homologacao is
  'Próximo número da NFC-e no ambiente de homologação.';
comment on column public.organization_fiscal_profiles.nfce_series_producao is
  'Série da NFC-e no ambiente de produção.';
comment on column public.organization_fiscal_profiles.nfce_next_number_producao is
  'Próximo número da NFC-e no ambiente de produção.';

update public.organization_fiscal_profiles
set
  nfce_series_homologacao = coalesce(nfce_series_homologacao, nfce_series, 1),
  nfce_next_number_homologacao = coalesce(nfce_next_number_homologacao, nfce_next_number, 1),
  nfce_series_producao = coalesce(nfce_series_producao, nfce_series, 1),
  nfce_next_number_producao = coalesce(nfce_next_number_producao, nfce_next_number, 1);

alter table public.organization_fiscal_profiles
  alter column nfce_series_homologacao set default 1,
  alter column nfce_next_number_homologacao set default 1,
  alter column nfce_series_producao set default 1,
  alter column nfce_next_number_producao set default 1,
  alter column nfce_series_homologacao set not null,
  alter column nfce_next_number_homologacao set not null,
  alter column nfce_series_producao set not null,
  alter column nfce_next_number_producao set not null;

alter table public.organization_fiscal_profiles
  drop constraint if exists organization_fiscal_profiles_nfce_series_homologacao_check,
  drop constraint if exists organization_fiscal_profiles_nfce_next_number_homologacao_check,
  drop constraint if exists organization_fiscal_profiles_nfce_series_producao_check,
  drop constraint if exists organization_fiscal_profiles_nfce_next_number_producao_check;

alter table public.organization_fiscal_profiles
  add constraint organization_fiscal_profiles_nfce_series_homologacao_check
    check (nfce_series_homologacao > 0),
  add constraint organization_fiscal_profiles_nfce_next_number_homologacao_check
    check (nfce_next_number_homologacao > 0),
  add constraint organization_fiscal_profiles_nfce_series_producao_check
    check (nfce_series_producao > 0),
  add constraint organization_fiscal_profiles_nfce_next_number_producao_check
    check (nfce_next_number_producao > 0);

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
    if p_environment = 'producao' then
      series := coalesce(profile_row.nfce_series_producao, profile_row.nfce_series);
      number := coalesce(profile_row.nfce_next_number_producao, profile_row.nfce_next_number);

      update public.organization_fiscal_profiles
      set
        nfce_series_producao = series,
        nfce_next_number_producao = number + 1,
        nfce_series = case when fiscal_environment = 'producao' then series else nfce_series end,
        nfce_next_number = case when fiscal_environment = 'producao' then number + 1 else nfce_next_number end,
        updated_at = now()
      where organization_id = p_organization_id;
    else
      series := coalesce(profile_row.nfce_series_homologacao, profile_row.nfce_series);
      number := coalesce(profile_row.nfce_next_number_homologacao, profile_row.nfce_next_number);

      update public.organization_fiscal_profiles
      set
        nfce_series_homologacao = series,
        nfce_next_number_homologacao = number + 1,
        nfce_series = case when fiscal_environment <> 'producao' then series else nfce_series end,
        nfce_next_number = case when fiscal_environment <> 'producao' then number + 1 else nfce_next_number end,
        updated_at = now()
      where organization_id = p_organization_id;
    end if;

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
