import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Produto pai (tem pelo menos uma variação) não deve ter estoque próprio.
 */
export async function fetchProductHasVariationChildren (
  supabase: SupabaseClient,
  productId: string,
): Promise<boolean> {
  const id = String(productId || '').trim()
  if (!id) return false

  const { count: byParentUuid, error: uuidErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('parent_product_id', id)
  if (!uuidErr && (byParentUuid ?? 0) > 0) return true

  const { data: product } = await supabase
    .from('products')
    .select('bling_id')
    .eq('id', id)
    .maybeSingle()

  const blingId = product?.bling_id != null ? String(product.bling_id).trim() : ''
  if (!blingId) return false

  const { count: byParentBling, error: blingErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('parent_bling_id', blingId)
  if (blingErr) return false
  return (byParentBling ?? 0) > 0
}

/** Serviço ou produto pai: não recebe movimentação de estoque. */
export async function fetchProductIsStockless (
  supabase: SupabaseClient,
  productId: string,
): Promise<boolean> {
  const id = String(productId || '').trim()
  if (!id) return false

  const { data: product } = await supabase
    .from('products')
    .select('kind')
    .eq('id', id)
    .maybeSingle()

  if (!product) return false
  if (String(product.kind || '').toLowerCase() === 'service') return true
  return fetchProductHasVariationChildren(supabase, id)
}
