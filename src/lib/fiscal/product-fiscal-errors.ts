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
  return fiscalEditorHref('65', documentId, options)
}

export function nfeEditorHref (documentId: string, options?: { corrigir?: boolean }) {
  return fiscalEditorHref('55', documentId, options)
}

export function fiscalEditorHref (
  model: '55' | '65',
  documentId: string,
  options?: { corrigir?: boolean },
) {
  const path = model === '55'
    ? `/portal/vendas/nfe/${encodeURIComponent(documentId)}`
    : `/portal/vendas/nfce/${encodeURIComponent(documentId)}`
  return options?.corrigir ? `${path}?corrigir=1` : path
}
