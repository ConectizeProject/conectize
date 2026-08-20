export type FiscalDocumentStatus =
  | 'pending'
  | 'authorized'
  | 'rejected'
  | 'canceled'
  | 'denied'

export function fiscalDocumentStatusLabel (
  status: FiscalDocumentStatus | string | null | undefined,
  model: '55' | '65' | string = '65',
) {
  const kind = model === '55' ? 'NF-e' : 'NFC-e'
  if (status === 'authorized') return `${kind} autorizada`
  if (status === 'pending') return `${kind} pendente`
  if (status === 'rejected') return `${kind} rejeitada`
  if (status === 'denied') return `${kind} denegada`
  if (status === 'canceled') return `${kind} cancelada`
  return kind
}

export function fiscalDocumentStatusBadgeVariant (
  status: FiscalDocumentStatus | string | null | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'authorized') return 'secondary'
  if (status === 'pending') return 'outline'
  if (status === 'canceled') return 'outline'
  if (status === 'rejected' || status === 'denied') return 'destructive'
  return 'default'
}

export function canEditFiscalDocument (
  status: FiscalDocumentStatus | string | null | undefined,
) {
  return status === 'pending' || status === 'rejected' || status === 'denied'
}

export function canSendFiscalDocument (
  status: FiscalDocumentStatus | string | null | undefined,
) {
  return status === 'pending' || status === 'rejected' || status === 'denied'
}

export function canCancelFiscalDocument (
  status: FiscalDocumentStatus | string | null | undefined,
) {
  return status === 'authorized'
}

export function canPrintFiscalDocument (
  status: FiscalDocumentStatus | string | null | undefined,
) {
  return status === 'authorized'
}

export function canDownloadFiscalXml (
  status: FiscalDocumentStatus | string | null | undefined,
) {
  return status === 'authorized' || status === 'canceled'
}

/** 135 = evento vinculado; 155 = cancelamento homologado (fora do prazo ou já cancelada). */
export function isSefazCancelConfirmed (statusCode: string | null | undefined) {
  const code = String(statusCode || '').trim()
  return code === '135' || code === '155'
}

export function isSefazDenied (statusCode: string | null | undefined) {
  const code = String(statusCode || '').trim()
  return code === '110' || code === '301' || code === '302'
}

export function fiscalDocumentKind (model: '55' | '65' | string | null | undefined) {
  return model === '55' ? 'NF-e' : 'NFC-e'
}

