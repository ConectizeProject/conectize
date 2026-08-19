export const PRODUCT_FISCAL_CORRECTION_ERRORS = [
  'product_missing_ncm',
  'product_invalid_cest',
  'cest_required',
  'cest_mismatch',
  'cest_not_required',
  'product_missing_fci',
] as const

export function isProductFiscalCorrectionError (error: unknown) {
  return PRODUCT_FISCAL_CORRECTION_ERRORS.includes(
    String(error || '') as (typeof PRODUCT_FISCAL_CORRECTION_ERRORS)[number],
  )
}

export function nfceEditorHref (documentId: string, options?: { corrigir?: boolean }) {
  const path = `/portal/vendas/nfce/${encodeURIComponent(documentId)}`
  return options?.corrigir ? `${path}?corrigir=1` : path
}
