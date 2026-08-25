import { isUuidRouteParam } from '@/lib/orders/ordem-portal-path'

type QuoteLike = {
  id: string
  display_number?: number | string | null
}

function normalizeDisplayNumber (n: number | string | null | undefined): number | null {
  if (n == null || n === '') return null
  const num = typeof n === 'number' ? n : parseInt(String(n), 10)
  return Number.isFinite(num) ? num : null
}

export function getOrcamentoPortalPathSegment (quote: QuoteLike) {
  const n = normalizeDisplayNumber(quote.display_number)
  if (n != null) return String(n)
  return quote.id
}

export function getOrcamentoPortalPath (quote: QuoteLike) {
  return `/portal/orcamentos/${getOrcamentoPortalPathSegment(quote)}`
}

export type ResolvedQuoteRoute =
  | { kind: 'id'; value: string }
  | { kind: 'display_number'; value: number }

export function parseOrcamentoRouteParam (raw: string): ResolvedQuoteRoute | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (isUuidRouteParam(trimmed)) {
    return { kind: 'id', value: trimmed }
  }
  const n = parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return { kind: 'display_number', value: n }
}
