/**
 * "Considerações da assistência" (saída): checklist + fotos de saída.
 * Usado para avisar antes de finalizar a OS sem registro de saída.
 */

import { isFinalizedOrderStatus } from '@/lib/orders/order-status'

/** Finalizações em que faz sentido exigir registro de saída (não inclui cancelada). */
export const EXIT_CONSIDERATIONS_REQUIRED_STATUSES = new Set([
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
])

/**
 * `true` se não há fotos de saída e o checklist está no estado “vazio”
 * (equivalente a nunca ter sido preenchido).
 */
export function isExitConsiderationsEmpty (
  deviceExitChecks: unknown,
  exitPhotoCount: number,
): boolean {
  if (exitPhotoCount > 0) return false
  if (deviceExitChecks == null) return true
  if (typeof deviceExitChecks !== 'object') return true
  const o = deviceExitChecks as { status?: string; checks?: Record<string, unknown> }
  const st = typeof o.status === 'string' ? o.status : 'operante'
  if (st !== 'operante') return false
  const checks = o.checks && typeof o.checks === 'object' ? o.checks : {}
  for (const v of Object.values(checks)) {
    if (v === true || v === false) return false
    if (v === 'ok' || v === 'fail' || v === 'na') return false
  }
  return true
}

export function shouldRequireExitConsiderationsOnStatusChange (
  previousStatus: string,
  nextStatus: string,
): boolean {
  const prev = String(previousStatus || '').trim()
  const next = String(nextStatus || '').trim()
  if (!EXIT_CONSIDERATIONS_REQUIRED_STATUSES.has(next)) return false
  if (isFinalizedOrderStatus(prev)) return false
  return true
}
