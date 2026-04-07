import type { SupabaseClient } from '@supabase/supabase-js'

const IN_CHUNK = 80

export async function expandSearchVisibleProductIds (
  supabase: SupabaseClient,
  searchTokens: string[],
): Promise<Set<string>> {
  const ids = new Set<string>()
  if (searchTokens.length === 0) return ids

  let matchQuery = supabase
    .from('products')
    .select('id, parent_bling_id, bling_id')
    .eq('is_active', true)

  for (const token of searchTokens) {
    matchQuery = matchQuery.or(
      `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
    )
  }

  const { data: matchRows } = await matchQuery
  const parentBlingToResolve = new Set<string>()

  for (const row of matchRows ?? []) {
    ids.add(String((row as { id: string }).id))
    const pb = (row as { parent_bling_id?: string | null }).parent_bling_id
    if (pb != null && String(pb).trim() !== '') {
      parentBlingToResolve.add(String(pb).trim())
    }
  }

  if (parentBlingToResolve.size > 0) {
    const keys = [...parentBlingToResolve]
    for (let i = 0; i < keys.length; i += IN_CHUNK) {
      const chunk = keys.slice(i, i + IN_CHUNK)
      const { data: parents } = await supabase
        .from('products')
        .select('id')
        .is('parent_bling_id', null)
        .in('bling_id', chunk)

      for (const p of parents ?? []) {
        if ((p as { id?: string }).id) ids.add(String((p as { id: string }).id))
      }
    }
  }

  const idList = [...ids]
  if (idList.length === 0) return ids

  const rootBlingIds = new Set<string>()
  for (let i = 0; i < idList.length; i += IN_CHUNK) {
    const chunk = idList.slice(i, i + IN_CHUNK)
    const { data: idRows } = await supabase
      .from('products')
      .select('bling_id, parent_bling_id')
      .in('id', chunk)

    for (const r of idRows ?? []) {
      const row = r as { bling_id?: string | null; parent_bling_id?: string | null }
      if (!row.parent_bling_id && row.bling_id && String(row.bling_id).trim() !== '') {
        rootBlingIds.add(String(row.bling_id).trim())
      }
    }
  }

  if (rootBlingIds.size > 0) {
    const roots = [...rootBlingIds]
    for (let i = 0; i < roots.length; i += IN_CHUNK) {
      const chunk = roots.slice(i, i + IN_CHUNK)
      let childQuery = supabase
        .from('products')
        .select('id')
        .eq('is_active', true)
        .in('parent_bling_id', chunk)

      for (const token of searchTokens) {
        childQuery = childQuery.or(
          `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
        )
      }

      const { data: kids } = await childQuery
      for (const k of kids ?? []) {
        if ((k as { id?: string }).id) ids.add(String((k as { id: string }).id))
      }
    }
  }

  return ids
}

export type IdSortRow = {
  id: string
  catalog_sort_key: string | null
  created_at: string
}

export async function fetchIdSortRowsInChunks (
  supabase: SupabaseClient,
  ids: string[],
): Promise<IdSortRow[]> {
  const out: IdSortRow[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { data } = await supabase
      .from('products')
      .select('id, catalog_sort_key, created_at')
      .in('id', chunk)

    for (const r of data ?? []) {
      const row = r as {
        id: string
        catalog_sort_key?: string | null
        created_at?: string
      }
      out.push({
        id: String(row.id),
        catalog_sort_key:
          row.catalog_sort_key != null && String(row.catalog_sort_key).trim() !== ''
            ? String(row.catalog_sort_key).trim()
            : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
      })
    }
  }
  return out
}

export function compareFlatCatalogSort (a: IdSortRow, b: IdSortRow): number {
  const ak = a.catalog_sort_key ?? '\uffff'
  const bk = b.catalog_sort_key ?? '\uffff'
  if (ak !== bk) {
    return ak < bk ? -1 : 1
  }
  const at = a.created_at ? new Date(a.created_at).getTime() : 0
  const bt = b.created_at ? new Date(b.created_at).getTime() : 0
  return bt - at
}

export async function fetchProductsByIdsOrdered (
  supabase: SupabaseClient,
  orderedIds: string[],
  selectColumns: string,
): Promise<Record<string, unknown>[]> {
  if (orderedIds.length === 0) return []

  const byId = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < orderedIds.length; i += IN_CHUNK) {
    const chunk = orderedIds.slice(i, i + IN_CHUNK)
    const { data } = await supabase.from('products').select(selectColumns).in('id', chunk)
    for (const row of data ?? []) {
      const r = row as unknown as Record<string, unknown>
      if (r.id != null) byId.set(String(r.id), r)
    }
  }

  return orderedIds.map((id) => byId.get(id)).filter(Boolean) as Record<string, unknown>[]
}
