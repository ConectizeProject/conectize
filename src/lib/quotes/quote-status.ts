/**
 * Status de orçamento (entidade quotes, distinta da OS).
 */

import { saoPauloYmd } from '@/lib/quotes/quote-dates'

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
  convertido: 'Convertido',
  cancelado: 'Cancelado',
}

export const QUOTE_STATUS_VALUES = [
  'rascunho',
  'enviado',
  'aprovado',
  'recusado',
  'expirado',
  'convertido',
  'cancelado',
] as const

export type QuoteStatusValue = (typeof QUOTE_STATUS_VALUES)[number]

export const QUOTE_STATUS_SET = new Set<string>(QUOTE_STATUS_VALUES)

/** Status que ainda podem expirar automaticamente pela validade. */
export const QUOTE_EXPIRE_ELIGIBLE_STATUSES = [
  'rascunho',
  'enviado',
  'aprovado',
] as const

export const QUOTE_EXPIRE_ELIGIBLE_SET = new Set<string>(
  QUOTE_EXPIRE_ELIGIBLE_STATUSES,
)

/** Status que o usuário pode escolher manualmente (convertido só via “Criar OS”). */
export const QUOTE_MANUAL_STATUS_VALUES = QUOTE_STATUS_VALUES.filter(
  (s) => s !== 'convertido',
)

export const QUOTE_MANUAL_STATUS_SET = new Set<string>(QUOTE_MANUAL_STATUS_VALUES)

export function getQuoteStatusLabel (status: string): string {
  return QUOTE_STATUS_LABELS[status] ?? status
}

export function isValidQuoteStatus (value: string): boolean {
  return QUOTE_STATUS_SET.has(value)
}

export function isManualQuoteStatus (value: string): boolean {
  return QUOTE_MANUAL_STATUS_SET.has(value)
}

export function canConvertQuoteStatus (status: string): boolean {
  return status !== 'convertido' && status !== 'cancelado'
}

/** Status exibido: vencido vira expirado sem precisar gravar no banco. */
export function effectiveQuoteStatus (
  status: string,
  validUntil: string | null | undefined,
  today: string = saoPauloYmd(),
): string {
  const ymd = String(validUntil || '').slice(0, 10)
  if (QUOTE_EXPIRE_ELIGIBLE_SET.has(status) && ymd && ymd < today) {
    return 'expirado'
  }
  return status
}
