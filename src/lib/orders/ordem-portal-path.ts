/**
 * URLs do portal usam o número de exibição da OS (`display_number`) quando existir;
 * caso contrário o UUID. Rotas antigas com UUID no path continuam válidas.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidRouteParam (s: string) {
  return UUID_RE.test(String(s || '').trim())
}

type OrderLike = {
  id: string
  display_number?: number | string | null
}

function normalizeDisplayNumber (n: number | string | null | undefined): number | null {
  if (n == null || n === '') return null
  const num = typeof n === 'number' ? n : parseInt(String(n), 10)
  return Number.isFinite(num) ? num : null
}

/** Segmento usado em `/portal/ordens/[segmento]` (número ou id). */
export function getOrdemPortalPathSegment (order: OrderLike) {
  const n = normalizeDisplayNumber(order.display_number)
  if (n != null) return String(n)
  return order.id
}

/** Caminho completo da página de edição da OS. */
export function getOrdemPortalPath (order: OrderLike) {
  return `/portal/ordens/${getOrdemPortalPathSegment(order)}`
}

export type ResolvedOrderRoute =
  | { kind: 'id'; value: string }
  | { kind: 'display_number'; value: number }

/** Interpreta o parâmetro dinâmico da rota (número ou UUID legado). */
export function parseOrdemRouteParam (raw: string): ResolvedOrderRoute | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  if (isUuidRouteParam(trimmed)) {
    return { kind: 'id', value: trimmed }
  }
  const n = parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return { kind: 'display_number', value: n }
}
