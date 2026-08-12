import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWaDeliveryStatusUpgrade,
  mergePayloadDeliveryStatus,
  type WaDeliveryStatus,
} from '@/lib/whatsapp/whatsapp-message-delivery-status'

export async function applyWhatsappMessageDeliveryStatus (opts: {
  supabase: SupabaseClient
  stableWaMessageId: string
  waMessageId: string
  deliveryStatus: WaDeliveryStatus
}): Promise<boolean> {
  const tryIds = [
    opts.stableWaMessageId,
    opts.waMessageId,
  ].filter((id, i, arr) => id && arr.indexOf(id) === i)

  for (const waMessageId of tryIds) {
    const { data: row, error } = await opts.supabase
      .from('whatsapp_messages')
      .select('id, direction, payload')
      .eq('wa_message_id', waMessageId)
      .maybeSingle()

    if (error || !row?.id) continue
    if (row.direction !== 'out') continue

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

    if (!updErr) return true
  }

  return false
}
