import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Alinha o histórico de entradas de estoque ao custo de cadastro.
 * Mantém a ordem FIFO (quantidades e datas); só corrige `unit_value_cents`.
 * Saídas/perdas já gravadas não são alteradas.
 */
export async function repriceProductStockEntryUnitValues (input: {
  supabase: SupabaseClient
  organizationId: string
  productId: string
  unitValueCents: number
}): Promise<{ ok: true, updated: number } | { ok: false, error: string }> {
  const productId = String(input.productId || '').trim()
  if (!productId) return { ok: false, error: 'product_required' }
  const unitValueCents = Math.max(0, Math.trunc(Number(input.unitValueCents) || 0))

  const { data, error } = await input.supabase
    .from('product_stock_movements')
    .update({
      unit_value_cents: unitValueCents,
    })
    .eq('organization_id', input.organizationId)
    .eq('product_id', productId)
    .eq('type', 'entry')
    .neq('unit_value_cents', unitValueCents)
    .select('id')

  if (error) return { ok: false, error: error.message || 'db_error' }
  return { ok: true, updated: (data ?? []).length }
}
