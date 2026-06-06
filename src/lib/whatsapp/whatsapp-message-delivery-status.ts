/** Status de entrega/leitura (ticks do WhatsApp) para mensagens enviadas. */

export type WaDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'played'

const RANK: Record<WaDeliveryStatus, number> = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  played: 4,
}

export function normalizeWaDeliveryStatus (raw: unknown): WaDeliveryStatus | null {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    if (n <= 1) return 'sent'
    if (n === 2) return 'sent'
    if (n === 3) return 'delivered'
    if (n === 4) return 'read'
    if (n >= 5) return 'played'
    return null
  }

  const low = String(raw).trim().toLowerCase()
  if (low === 'sending') return 'sending'

  const s = String(raw).trim().toUpperCase().replace(/\./g, '_').replace(/-/g, '_')
  if (!s) return null

  if (s === 'SENDING') return 'sending'
  if (s === 'PLAYED' || s.includes('PLAYED')) return 'played'
  if (s === 'READ' || s.includes('READ')) return 'read'
  if (
    s === 'DELIVERY_ACK' ||
    s === 'DELIVERED' ||
    s === 'RECEIVED' ||
    s.includes('DELIVERY')
  ) {
    return 'delivered'
  }
  if (
    s === 'SERVER_ACK' ||
    s === 'PENDING' ||
    s === 'SENT' ||
    s.includes('SERVER')
  ) {
    return 'sent'
  }

  return null
}

export function isWaDeliveryStatusUpgrade (
  current: unknown,
  next: WaDeliveryStatus,
): boolean {
  const cur = normalizeWaDeliveryStatus(current)
  if (!cur) return true
  return RANK[next] > RANK[cur]
}

export function getDeliveryStatusFromPayload (
  payload?: Record<string, unknown> | null,
): WaDeliveryStatus | null {
  if (!payload || typeof payload !== 'object') return null
  return normalizeWaDeliveryStatus(payload.delivery_status)
}

/** Mensagens outbound sem status gravado — exibe um v (enviada). */
export function resolveOutboundDeliveryStatus (
  payload?: Record<string, unknown> | null,
): WaDeliveryStatus {
  return getDeliveryStatusFromPayload(payload) ?? 'sent'
}

export function mergePayloadDeliveryStatus (
  payload: Record<string, unknown> | null | undefined,
  status: WaDeliveryStatus,
): Record<string, unknown> {
  const base = payload && typeof payload === 'object' ? { ...payload } : {}
  const current = base.delivery_status
  if (!isWaDeliveryStatusUpgrade(current, status)) return base
  return { ...base, delivery_status: status }
}
