export type FiscalNumberingEnvironment = 'homologacao' | 'producao'

export type FiscalNumberingProfileRow = {
  fiscal_environment?: string | null
  nfce_series?: number | null
  nfce_next_number?: number | null
  nfce_series_homologacao?: number | null
  nfce_next_number_homologacao?: number | null
  nfce_series_producao?: number | null
  nfce_next_number_producao?: number | null
}

function positiveInt (value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.round(n)
}

export function nfceNumberingForEnvironment (
  profile: FiscalNumberingProfileRow,
  environment: FiscalNumberingEnvironment,
) {
  if (environment === 'producao') {
    return {
      series: positiveInt(profile.nfce_series_producao)
        || (profile.fiscal_environment === 'producao' ? positiveInt(profile.nfce_series) : null)
        || 1,
      nextNumber: positiveInt(profile.nfce_next_number_producao)
        || (profile.fiscal_environment === 'producao' ? positiveInt(profile.nfce_next_number) : null)
        || 1,
    }
  }

  return {
    series: positiveInt(profile.nfce_series_homologacao)
      || (profile.fiscal_environment !== 'producao' ? positiveInt(profile.nfce_series) : null)
      || 1,
    nextNumber: positiveInt(profile.nfce_next_number_homologacao)
      || (profile.fiscal_environment !== 'producao' ? positiveInt(profile.nfce_next_number) : null)
      || 1,
  }
}
