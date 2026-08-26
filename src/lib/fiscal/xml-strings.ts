/** Limites TString do leiaute NF-e/NFC-e 4.00 (XSD). Estouro vira rejeição 215. */
export const NFE_XNOME_MAX = 60
export const NFE_XFANT_MAX = 60
export const NFE_XPROD_MAX = 120
export const NFE_CPROD_MAX = 60
export const NFE_XLGR_MAX = 60
export const NFE_XNRO_MAX = 60
export const NFE_XCPL_MAX = 60
export const NFE_XBAIRRO_MAX = 60
export const NFE_XMUN_MAX = 60
export const NFE_NATOP_MAX = 60
export const NFE_UNID_MAX = 6
export const NFE_INFCPL_MAX = 5000

/**
 * Texto aceito no schema: Latin-1, sem controle, sem espaço nas pontas, no máximo `max` chars.
 */
export function nfeXmlText (value: unknown, max: number): string {
  const cleaned = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[^\u0020-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max).trim()
}

/** Limite do campo de nome do destinatário (mesmo teto do xNome no XML). */
export function clampFiscalCustomerName (value: unknown): string {
  return String(value ?? '').slice(0, NFE_XNOME_MAX)
}
