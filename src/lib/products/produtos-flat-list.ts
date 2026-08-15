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
    .select('id, parent_bling_id, parent_product_id, bling_id')
    .eq('is_active', true)

  for (const token of searchTokens) {
    matchQuery = matchQuery.or(
      `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
    )
  }

  const { data: matchRows } = await matchQuery
  const parentBlingToResolve = new Set<string>()
  const parentUuidToResolve = new Set<string>()

  for (const row of matchRows ?? []) {
    ids.add(String((row as { id: string }).id))
    const pb = (row as { parent_bling_id?: string | null }).parent_bling_id
    if (pb != null && String(pb).trim() !== '') {
      parentBlingToResolve.add(String(pb).trim())
    }
    const pp = (row as { parent_product_id?: string | null }).parent_product_id
    if (pp != null && String(pp).trim() !== '') {
      parentUuidToResolve.add(String(pp).trim())
    }
  }

  for (const parentId of parentUuidToResolve) {
    ids.add(parentId)
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

export const PRODUCT_SORT_ROW_SELECT =
  'id, bling_id, parent_bling_id, parent_product_id, catalog_sort_key, created_at, updated_at, kind, sku, barcode'

export type IdSortRow = {
  id: string
  catalog_sort_key: string | null
  created_at: string
  updated_at: string
  bling_id: string | null
  parent_bling_id: string | null
  parent_product_id: string | null
  kind?: string | null
  sku?: string | null
  barcode?: string | null
}

function trimOrNull (value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

export function mapProductRowToIdSortRow (raw: Record<string, unknown>): IdSortRow {
  const createdAt = typeof raw.created_at === 'string' ? raw.created_at : ''
  const updatedAt = typeof raw.updated_at === 'string' ? raw.updated_at : createdAt
  return {
    id: String(raw.id),
    catalog_sort_key: trimOrNull(raw.catalog_sort_key),
    created_at: createdAt,
    updated_at: updatedAt,
    bling_id: trimOrNull(raw.bling_id),
    parent_bling_id: trimOrNull(raw.parent_bling_id),
    parent_product_id: trimOrNull(raw.parent_product_id),
    kind: raw.kind == null ? null : String(raw.kind),
    sku: trimOrNull(raw.sku),
    barcode: trimOrNull(raw.barcode),
  }
}

export function isChildSortRow (row: IdSortRow): boolean {
  return Boolean(row.parent_bling_id || row.parent_product_id)
}

function activityMs (row: IdSortRow): number {
  const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0
  const created = row.created_at ? new Date(row.created_at).getTime() : 0
  const u = Number.isFinite(updated) ? updated : 0
  const c = Number.isFinite(created) ? created : 0
  return Math.max(u, c)
}

function compareChildrenWithinFamily (a: IdSortRow, b: IdSortRow): number {
  const ak = a.catalog_sort_key ?? '\uffff'
  const bk = b.catalog_sort_key ?? '\uffff'
  if (ak !== bk) return ak < bk ? -1 : 1
  const at = a.created_at ? new Date(a.created_at).getTime() : 0
  const bt = b.created_at ? new Date(b.created_at).getTime() : 0
  return at - bt
}

function familyIdForRow (
  row: IdSortRow,
  parentIdByBling: Map<string, string>,
): string {
  if (row.parent_product_id) return row.parent_product_id
  if (row.parent_bling_id) {
    return parentIdByBling.get(row.parent_bling_id) ?? `bling:${row.parent_bling_id}`
  }
  return row.id
}

/**
 * Agrupa pai + filhos e ordena famílias pela atividade mais recente (criação/edição).
 * Dentro da família: pai primeiro, depois filhos.
 */
export function groupProductRowsAsFamilies (rows: IdSortRow[]): IdSortRow[][] {
  const parentIdByBling = new Map<string, string>()
  for (const row of rows) {
    if (!isChildSortRow(row) && row.bling_id) {
      parentIdByBling.set(row.bling_id, row.id)
    }
  }

  const byFamily = new Map<string, IdSortRow[]>()
  for (const row of rows) {
    const key = familyIdForRow(row, parentIdByBling)
    const list = byFamily.get(key)
    if (list) list.push(row)
    else byFamily.set(key, [row])
  }

  const families = [...byFamily.entries()].map(([key, members]) => {
    const parents = members.filter((m) => !isChildSortRow(m))
    const children = members.filter((m) => isChildSortRow(m))
    children.sort(compareChildrenWithinFamily)
    const ordered = [...parents, ...children]
    const activity = Math.max(...members.map(activityMs), 0)
    return { key, activity, ordered }
  })

  families.sort((a, b) => {
    if (a.activity !== b.activity) return b.activity - a.activity
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })

  return families.map((f) => f.ordered)
}

export function includeParentsForChildren (
  allRows: IdSortRow[],
  filtered: IdSortRow[],
): IdSortRow[] {
  const allById = new Map(allRows.map((r) => [r.id, r]))
  const parentByBling = new Map<string, IdSortRow>()
  for (const row of allRows) {
    if (!isChildSortRow(row) && row.bling_id) parentByBling.set(row.bling_id, row)
  }

  const out = new Map<string, IdSortRow>()
  for (const row of filtered) out.set(row.id, row)

  for (const row of filtered) {
    if (!isChildSortRow(row)) continue
    if (row.parent_product_id) {
      const parent = allById.get(row.parent_product_id)
      if (parent) out.set(parent.id, parent)
    }
    if (row.parent_bling_id) {
      const parent = parentByBling.get(row.parent_bling_id)
      if (parent) out.set(parent.id, parent)
    }
  }

  return [...out.values()]
}

/**
 * Fatia famílias inteiras (nunca começa uma página só com filho órfão).
 * `offset` conta linhas já exibidas na lista agrupada.
 */
export function sliceProductFamilies (
  families: IdSortRow[][],
  offset: number,
  limit: number,
): { rows: IdSortRow[]; totalCount: number } {
  const totalCount = families.reduce((n, family) => n + family.length, 0)
  const safeOffset = Math.max(0, offset)
  const safeLimit = Math.max(1, limit)

  let skipped = 0
  let i = 0
  while (i < families.length && skipped + families[i].length <= safeOffset) {
    skipped += families[i].length
    i += 1
  }
  if (i < families.length && skipped < safeOffset) {
    skipped += families[i].length
    i += 1
  }

  const rows: IdSortRow[] = []
  let taken = 0
  while (i < families.length && taken < safeLimit) {
    rows.push(...families[i])
    taken += families[i].length
    i += 1
  }

  return { rows, totalCount }
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
      .select(PRODUCT_SORT_ROW_SELECT)
      .in('id', chunk)

    for (const r of data ?? []) {
      out.push(mapProductRowToIdSortRow(r as Record<string, unknown>))
    }
  }
  return out
}

const ACTIVE_SORT_PAGE = 1000

export async function fetchActiveProductSortRows (
  supabase: SupabaseClient,
  kindFilter: 'product' | 'service' | 'all',
): Promise<IdSortRow[]> {
  const out: IdSortRow[] = []
  let from = 0
  for (;;) {
    let query = supabase
      .from('products')
      .select(PRODUCT_SORT_ROW_SELECT)
      .eq('is_active', true)
      .range(from, from + ACTIVE_SORT_PAGE - 1)

    if (kindFilter === 'service') query = query.eq('kind', 'service')
    else if (kindFilter === 'product') query = query.neq('kind', 'service')

    const { data, error } = await query
    if (error) throw error
    const chunk = (data ?? []).map((r) => mapProductRowToIdSortRow(r as Record<string, unknown>))
    out.push(...chunk)
    if (chunk.length < ACTIVE_SORT_PAGE) break
    from += ACTIVE_SORT_PAGE
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
