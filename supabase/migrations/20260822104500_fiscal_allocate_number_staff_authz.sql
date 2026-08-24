-- Restrict allocate_fiscal_document_number to staff/admin of the target org.
-- Service role (server-side emission) bypasses when auth.uid() is null.

create or replace function public.allocate_fiscal_document_number (
  p_organization_id uuid,
  p_model text,
  p_environment text
)
returns table(series integer, number bigint)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  profile_row public.organization_fiscal_profiles%rowtype;
begin
  if auth.uid() is not null then
    if not public.is_staff_or_admin() then
      raise exception 'forbidden';
    end if;

    if public.current_organization_id() is distinct from p_organization_id then
      raise exception 'forbidden';
    end if;
  end if;

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
      series := coalesce(profile_row.nfce_series_producao, profile_row.nfce_series, 1);
      number := coalesce(profile_row.nfce_next_number_producao, profile_row.nfce_next_number, 1);

      update public.organization_fiscal_profiles
      set
        nfce_series_producao = series,
        nfce_next_number_producao = number + 1,
        nfce_series = case when fiscal_environment = 'producao' then series else nfce_series end,
        nfce_next_number = case when fiscal_environment = 'producao' then number + 1 else nfce_next_number end,
        updated_at = now()
      where organization_id = p_organization_id;
    else
      series := coalesce(profile_row.nfce_series_homologacao, profile_row.nfce_series, 1);
      number := coalesce(profile_row.nfce_next_number_homologacao, profile_row.nfce_next_number, 1);

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
    series := coalesce(profile_row.nfe_series, 1);
    number := coalesce(profile_row.nfe_next_number, 1);

    update public.organization_fiscal_profiles
    set nfe_next_number = number + 1,
        updated_at = now()
    where organization_id = p_organization_id;

    return next;
    return;
  end if;

  raise exception 'invalid_fiscal_model';
end;
$$;

revoke all on function public.allocate_fiscal_document_number(uuid, text, text) from public;
grant execute on function public.allocate_fiscal_document_number(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
