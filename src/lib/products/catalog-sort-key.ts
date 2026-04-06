import type { SupabaseClient } from '@supabase/supabase-js'

/** Raiz: 12 dígitos (lexicográfico = numérico). Variação: `raiz` + '.' + 6 dígitos. */
export function nextParentCatalogSortKey (maxRootKey: string | null): string {
  if (maxRootKey != null && /^[0-9]{12}$/.test(maxRootKey)) {
    const n = BigInt(maxRootKey) + BigInt(1)
    return String(n).padStart(12, '0')
  }
  return '000000000001'
}

export function nextVariationCatalogSortKey (
  parentRootKey: string,
  maxChildKey: string | null,
): string {
  const prefix = `${parentRootKey}.`
  if (maxChildKey == null || !maxChildKey.startsWith(prefix)) {
    return `${parentRootKey}.000001`
  }
  const suffix = maxChildKey.slice(prefix.length)
  if (!/^[0-9]{6}$/.test(suffix)) {
    return `${parentRootKey}.000001`
  }
  const n = BigInt(suffix) + BigInt(1)
  return `${parentRootKey}.${String(n).padStart(6, '0')}`
}

type AllocateInput = {
  parentBlingId: string | null | undefined
}

/**
 * Próxima chave para INSERT (pai ou variação). Requer coluna `catalog_sort_key` no schema.
 */
export async function allocateCatalogSortKeyForInsert (
  supabase: SupabaseClient,
  input: AllocateInput,
): Promise<string> {
  const raw = input.parentBlingId != null ? String(input.parentBlingId).trim() : ''
  if (!raw || raw === '0') {
    const { data } = await supabase
      .from('products')
      .select('catalog_sort_key')
      .is('parent_bling_id', null)
      .not('catalog_sort_key', 'is', null)
      .order('catalog_sort_key', { ascending: false })
      .limit(1)
      .maybeSingle()

    const max = data && typeof data === 'object' && 'catalog_sort_key' in data
      ? (data as { catalog_sort_key: string | null }).catalog_sort_key
      : null
    const rootMax = max != null && String(max).length > 0 && !String(max).includes('.')
      ? String(max)
      : null
    return nextParentCatalogSortKey(rootMax)
  }

  const { data: parentRow } = await supabase
    .from('products')
    .select('catalog_sort_key')
    .eq('bling_id', raw)
    .is('parent_bling_id', null)
    .maybeSingle()

  let parentKey =
    parentRow && typeof parentRow === 'object' && 'catalog_sort_key' in parentRow
      ? (parentRow as { catalog_sort_key: string | null }).catalog_sort_key
      : null
  parentKey = parentKey != null && String(parentKey).trim() !== '' ? String(parentKey).trim() : null

  if (!parentKey || parentKey.includes('.')) {
    const { data: anyParent } = await supabase
      .from('products')
      .select('catalog_sort_key')
      .eq('bling_id', raw)
      .maybeSingle()
    const pk =
      anyParent && typeof anyParent === 'object' && 'catalog_sort_key' in anyParent
        ? (anyParent as { catalog_sort_key: string | null }).catalog_sort_key
        : null
    parentKey = pk != null && String(pk).trim() !== '' ? String(pk).trim() : null
  }

  if (!parentKey || parentKey.includes('.')) {
    return nextParentCatalogSortKey(null)
  }

  const { data: maxChild } = await supabase
    .from('products')
    .select('catalog_sort_key')
    .eq('parent_bling_id', raw)
    .not('catalog_sort_key', 'is', null)
    .order('catalog_sort_key', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxChildKey =
    maxChild && typeof maxChild === 'object' && 'catalog_sort_key' in maxChild
      ? (maxChild as { catalog_sort_key: string | null }).catalog_sort_key
      : null

  return nextVariationCatalogSortKey(parentKey, maxChildKey)
}
