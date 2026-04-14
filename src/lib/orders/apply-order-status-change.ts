import type { SupabaseClient } from '@supabase/supabase-js'
import { buildOrderEditDiff } from '@/lib/orders/order-edit-history'
import {
  isExitConsiderationsEmpty,
  shouldRequireExitConsiderationsOnStatusChange,
} from '@/lib/orders/exit-considerations'
import { isOrderWarrantyTermsUnset } from '@/lib/orders/order-warranty-terms'
import {
  FINALIZED_ORDER_STATUS_SET,
  ORDER_STATUS_SET,
} from '@/lib/orders/order-status'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'

export type ApplyOrderStatusChangeResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'invalid_status'
        | 'not_found'
        | 'db_error'
        | 'exit_considerations_incomplete'
        | 'warranty_terms_missing'
    }

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
    /** Após o usuário confirmar no diálogo que deseja finalizar sem saída registrada */
    skipExitConsiderationsCheck?: boolean
    /** Após confirmar finalizar sem modelo/texto de garantia */
    skipWarrantyTermsCheck?: boolean
  },
): Promise<ApplyOrderStatusChangeResult> {
  const {
    orderId,
    nextStatus,
    editorUserId,
    skipExitConsiderationsCheck,
    skipWarrantyTermsCheck,
  } = params

  if (!ORDER_STATUS_SET.has(nextStatus)) {
    return { ok: false, error: 'invalid_status' }
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('service_orders')
    .select(
      'status, services, closed_at, device_exit_checks, warranty_template_id, warranty_text',
    )
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

  if (
    !skipExitConsiderationsCheck &&
    shouldRequireExitConsiderationsOnStatusChange(previousStatus, nextStatus)
  ) {
    const { count: exitPhotoCount, error: exitCountErr } = await supabase
      .from('service_order_exit_photos')
      .select('*', { count: 'exact', head: true })
      .eq('service_order_id', orderId)

    if (exitCountErr) {
      console.error('[applyOrderStatusChange exit photos count]', exitCountErr)
      return { ok: false, error: 'db_error' }
    }

    const exitEmpty = isExitConsiderationsEmpty(
      (existing as { device_exit_checks?: unknown }).device_exit_checks,
      exitPhotoCount ?? 0,
    )
    if (exitEmpty) {
      return { ok: false, error: 'exit_considerations_incomplete' }
    }
  }

  if (
    !skipWarrantyTermsCheck &&
    shouldRequireExitConsiderationsOnStatusChange(previousStatus, nextStatus)
  ) {
    const row = existing as {
      warranty_template_id?: string | null
      warranty_text?: string | null
    }
    if (
      isOrderWarrantyTermsUnset({
        warranty_template_id: row.warranty_template_id,
        warranty_text: row.warranty_text,
      })
    ) {
      return { ok: false, error: 'warranty_terms_missing' }
    }
  }

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
