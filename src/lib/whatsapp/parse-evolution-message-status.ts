import { buildStableWaMessageId } from '@/lib/whatsapp/parse-evolution-webhook-messages'
import {
  normalizeWaDeliveryStatus,
  type WaDeliveryStatus,
} from '@/lib/whatsapp/whatsapp-message-delivery-status'

export type EvolutionMessageStatusUpdate = {
  instance: string
  waMessageId: string
  stableWaMessageId: string
  fromMe: boolean
  deliveryStatus: WaDeliveryStatus
}

/** MESSAGES_UPDATE da Evolution (keyId + status, não o formato UPSERT). */
export function parseEvolutionMessageStatusUpdates (
  payload: Record<string, unknown>,
): EvolutionMessageStatusUpdate[] {
  const instance = String(payload.instance || '').trim()
  if (!instance) return []

  const data = payload.data as unknown
  const items: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? [data]
      : []

  const out: EvolutionMessageStatusUpdate[] = []

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>

    const key = item.key as Record<string, unknown> | undefined
    const keyId = String(item.keyId ?? key?.id ?? '').trim()
    if (!keyId) continue

    const fromMe = item.fromMe === true || item.fromMe === 'true' || key?.fromMe === true
    if (!fromMe) continue

    const deliveryStatus = normalizeWaDeliveryStatus(item.status)
    if (!deliveryStatus) continue

    out.push({
      instance,
      waMessageId: keyId,
      stableWaMessageId: buildStableWaMessageId(instance, keyId),
      fromMe: true,
      deliveryStatus,
    })
  }

  return out
}
