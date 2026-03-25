import type { SupabaseClient } from '@supabase/supabase-js'
import { buildOrderEditDiff } from '@/lib/orders/order-edit-history'
import {
  FINALIZED_ORDER_STATUS_SET,
  ORDER_STATUS_SET,
} from '@/lib/orders/order-status'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'

export type ApplyOrderStatusChangeResult =
  | { ok: true }
  | { ok: false; error: 'invalid_status' | 'not_found' | 'db_error' }

/**
 * Atualiza apenas o status da OS (histórico, estoque, closed_at quando finalizado).
 * Usado pela API PATCH e pela server action do menu/lista.
 */
export async function applyOrderStatusChange (
  supabase: SupabaseClient,
  params: {
    orderId: string
    nextStatus: string
    editorUserId: string
  },
): Promise<ApplyOrderStatusChangeResult> {
  const { orderId, nextStatus, editorUserId } = params

  if (!ORDER_STATUS_SET.has(nextStatus)) {
    return { ok: false, error: 'invalid_status' }
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('service_orders')
    .select('status, services, closed_at')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[applyOrderStatusChange fetch]', fetchErr)
    return { ok: false, error: 'db_error' }
  }
  if (!existing) {
    return { ok: false, error: 'not_found' }
  }

  const previousStatus = String(existing.status || '')
  const updatePayload: Record<string, unknown> = { status: nextStatus }
  if (FINALIZED_ORDER_STATUS_SET.has(nextStatus)) {
    updatePayload.closed_at = new Date().toISOString()
  }

  const { error: upErr } = await supabase
    .from('service_orders')
    .update(updatePayload)
    .eq('id', orderId)

  if (upErr) {
    console.error('[applyOrderStatusChange update]', upErr)
    return { ok: false, error: 'db_error' }
  }

  const diffRows = buildOrderEditDiff(
    existing as Record<string, unknown>,
    updatePayload,
  )
  if (diffRows.length > 0) {
    const editedAt = new Date().toISOString()
    const { error: histErr } = await supabase
      .from('service_order_edit_history')
      .insert(
        diffRows.map((r) => ({
          service_order_id: orderId,
          edited_by: editorUserId,
          edited_at: editedAt,
          field_key: r.field_key,
          old_value: r.old_value,
          new_value: r.new_value,
        })),
      )
    if (histErr) {
      console.error('[applyOrderStatusChange edit-history]', histErr)
    }
  }

  try {
    await applyOrderStatusStockTransition({
      supabase,
      orderId,
      previousStatus,
      nextStatus,
      services: existing.services,
      actorUserId: editorUserId,
    })
  } catch (err) {
    console.error('[applyOrderStatusChange stock]', err)
  }

  return { ok: true }
}
