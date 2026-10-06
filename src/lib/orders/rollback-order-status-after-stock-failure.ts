import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reverte status (e closed_at, se a persistência anterior o alterou) após falha
 * de estoque. Sem isso, cancelar/finalizar pode ficar preso sem devolução e o
 * retry não reconcilia (`shouldReturnOnStatusTransition` exige status anterior
 * consumindo estoque).
 */
export async function rollbackOrderStatusAfterStockFailure (
  supabase: SupabaseClient,
  params: {
    orderId: string
    previousStatus: string
    previousClosedAt: string | null
    /** Payload da atualização que acabou de ser persistida (para saber se closed_at mudou). */
    updatePayload: Record<string, unknown>
    logLabel: string
    nextStatus?: string
  },
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const rollbackPayload: Record<string, unknown> = { status: params.previousStatus }
  if (Object.prototype.hasOwnProperty.call(params.updatePayload, 'closed_at')) {
    rollbackPayload.closed_at = params.previousClosedAt
  }
  const { error: rollbackErr } = await supabase
    .from('service_orders')
    .update(rollbackPayload)
    .eq('id', params.orderId)
  if (rollbackErr) {
    console.error(`[${params.logLabel} stock-rollback]`, {
      orderId: params.orderId,
      previousStatus: params.previousStatus,
      nextStatus: params.nextStatus,
      rollbackErr,
    })
    return { ok: false, error: rollbackErr }
  }
  return { ok: true }
}
