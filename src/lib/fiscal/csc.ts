export type FiscalCscEnvironment = 'homologacao' | 'producao'

export type FiscalCscProfileRow = {
  fiscal_environment?: string | null
  nfce_csc_id?: string | null
  nfce_csc_ciphertext?: string | null
  nfce_csc_id_homologacao?: string | null
  nfce_csc_ciphertext_homologacao?: string | null
  nfce_csc_id_producao?: string | null
  nfce_csc_ciphertext_producao?: string | null
}

function nullIfEmpty (value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

export function nfceCscForEnvironment (profile: FiscalCscProfileRow, environment: FiscalCscEnvironment) {
  if (environment === 'producao') {
    return {
      id: nullIfEmpty(profile.nfce_csc_id_producao) || (profile.fiscal_environment === 'producao' ? nullIfEmpty(profile.nfce_csc_id) : null),
      ciphertext: nullIfEmpty(profile.nfce_csc_ciphertext_producao)
        || (profile.fiscal_environment === 'producao' ? nullIfEmpty(profile.nfce_csc_ciphertext) : null),
    }
  }
  return {
    id: nullIfEmpty(profile.nfce_csc_id_homologacao) || (profile.fiscal_environment !== 'producao' ? nullIfEmpty(profile.nfce_csc_id) : null),
    ciphertext: nullIfEmpty(profile.nfce_csc_ciphertext_homologacao)
      || (profile.fiscal_environment !== 'producao' ? nullIfEmpty(profile.nfce_csc_ciphertext) : null),
  }
}
