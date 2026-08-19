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

export function parseAllocatedFiscalNumber (data: unknown) {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const record = row as { series?: unknown, number?: unknown }
  const series = positiveInt(record.series)
  const number = positiveInt(record.number)
  if (!series || !number) return null
  return { series, number }
}

export function isMissingColumnError (error: { message?: string, code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '42703'
    || error?.code === 'PGRST204'
    || message.includes('does not exist')
    || message.includes('schema cache')
}

export function nfceNumberingPatch (
  profile: FiscalNumberingProfileRow,
  environment: FiscalNumberingEnvironment,
) {
  const numbering = nfceNumberingForEnvironment(profile, environment)
  const nextNumber = numbering.nextNumber + 1
  const activePatch = {
    nfce_series: numbering.series,
    nfce_next_number: nextNumber,
  }

  if (environment === 'producao') {
    return {
      numbering,
      patch: {
        nfce_series_producao: numbering.series,
        nfce_next_number_producao: nextNumber,
        ...(profile.fiscal_environment === 'producao' ? activePatch : {}),
      },
      legacyPatch: activePatch,
    }
  }

  return {
    numbering,
    patch: {
      nfce_series_homologacao: numbering.series,
      nfce_next_number_homologacao: nextNumber,
      ...(profile.fiscal_environment !== 'producao' ? activePatch : {}),
    },
    legacyPatch: activePatch,
  }
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
