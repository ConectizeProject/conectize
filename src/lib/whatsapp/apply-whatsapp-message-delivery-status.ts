import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWaDeliveryStatusUpgrade,
  mergePayloadDeliveryStatus,
  type WaDeliveryStatus,
} from '@/lib/whatsapp/whatsapp-message-delivery-status'

export async function applyWhatsappMessageDeliveryStatus (opts: {
  supabase: SupabaseClient
  stableWaMessageId: string
  /** @deprecated Ignorado: só `stableWaMessageId` (instance:keyId) evita cruzar tenants. */
  waMessageId?: string
  deliveryStatus: WaDeliveryStatus
}): Promise<boolean> {
  const waMessageId = String(opts.stableWaMessageId || '').trim()
  if (!waMessageId || !waMessageId.includes(':')) return false

  const { data: row, error } = await opts.supabase
    .from('whatsapp_messages')
    .select('id, direction, payload')
    .eq('wa_message_id', waMessageId)
    .maybeSingle()

  if (error || !row?.id) return false
  if (row.direction !== 'out') return false

  const payload = (row.payload as Record<string, unknown> | null) || {}
  if (!isWaDeliveryStatusUpgrade(payload.delivery_status, opts.deliveryStatus)) {
    return true
  }

  const { error: updErr } = await opts.supabase
    .from('whatsapp_messages')
    .update({
      payload: mergePayloadDeliveryStatus(payload, opts.deliveryStatus),
    })
    .eq('id', row.id)

  return !updErr
}
