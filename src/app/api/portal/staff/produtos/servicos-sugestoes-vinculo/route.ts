import { type NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  buildDeviceModelSearchQueries,
  pickBestDeviceModelForCatalogName,
  suggestPricingTagFromName,
  type DeviceModelCandidate,
  deviceModelCandidateLabel,
} from '@/lib/products/suggest-service-product-links'

/** Tamanho de página ao varrer `products` (PostgREST `range` inclusivo). */
const PRODUCT_PAGE_SIZE = 1000
/** Limite de segurança: ~1M linhas; evita loop infinito se algo der errado. */
const MAX_PRODUCT_PAGES = 1024

function parseCatalogKind (raw: string | null): 'product' | 'service' {
  const k = String(raw || '').trim().toLowerCase()
  if (k === 'service') return 'service'
  return 'product'
}

function escapeIlikePattern (value: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

type Dt = { name?: string | null; device_brands?: { name?: string | null } | { name?: string | null }[] | null }
type ModelRow = {
  id: string
  model?: string | null
  device_types?: Dt | Dt[] | null
}

function mapRowsToCandidates (data: ModelRow[] | null): DeviceModelCandidate[] {
  return (data || []).map((row) => {
    const dt = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
    const br = dt?.device_brands
    const brand = Array.isArray(br) ? br[0] : br
    return {
      id: row.id,
      model: row.model ?? null,
      brand: brand?.name ?? null,
    }
  })
}

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const catalogKind = parseCatalogKind(new URL(request.url).searchParams.get('kind'))
  const { supabase } = auth

  const { data: tagRows, error: tagsError } = await supabase
    .from('pricing_tags')
    .select('id, name')
    .order('name', { ascending: true })

  if (tagsError || !tagRows) {
    return NextResponse.json({ ok: false, error: 'pricing_tags_load_failed' }, { status: 500 })
  }

  const tags = (tagRows as { id: string; name: string }[]).map((t) => ({
    id: String(t.id),
    name: String(t.name || ''),
  }))

  type ProductRow = { id: string; name: string; pricing_tag_id: string | null }
  const products: ProductRow[] = []

  for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
    const from = page * PRODUCT_PAGE_SIZE
    const to = from + PRODUCT_PAGE_SIZE - 1
    const { data: productRows, error: productsError } = await supabase
      .from('products')
      .select('id, name, pricing_tag_id')
      .eq('kind', catalogKind)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, to)

    if (productsError || !productRows) {
      return NextResponse.json({ ok: false, error: 'products_load_failed' }, { status: 500 })
    }

    const chunk = (productRows as ProductRow[]).map((p) => ({
      id: String(p.id),
      name: String(p.name || ''),
      pricing_tag_id: p.pricing_tag_id != null ? String(p.pricing_tag_id) : null,
    }))
    products.push(...chunk)

    if (chunk.length < PRODUCT_PAGE_SIZE) break
  }

  const tagNameById = new Map(tags.map((t) => [t.id, t.name]))
  const productIds = products.map((p) => p.id)

  const compatByProduct = new Map<string, string[]>()
  const chunkSize = 200
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize)
    const { data: compatRows, error: compatError } = await supabase
      .from('product_compatible_device_models')
      .select('product_id, device_model_id')
      .in('product_id', chunk)

    if (compatError) {
      return NextResponse.json({ ok: false, error: 'compat_load_failed' }, { status: 500 })
    }
    for (const row of compatRows || []) {
      const pid = String((row as { product_id: string }).product_id)
      const mid = String((row as { device_model_id: string }).device_model_id)
      const arr = compatByProduct.get(pid) ?? []
      arr.push(mid)
      compatByProduct.set(pid, arr)
    }
  }

  const allCurrentModelIds = [...new Set([...compatByProduct.values()].flat())]
  const modelLabelById = new Map<string, string>()
  for (let i = 0; i < allCurrentModelIds.length; i += chunkSize) {
    const chunk = allCurrentModelIds.slice(i, i + chunkSize)
    if (chunk.length === 0) continue
    const { data: models, error: mErr } = await supabase
      .from('device_models')
      .select('id, model, device_types ( name, device_brands ( name ) )')
      .in('id', chunk)
    if (mErr) {
      return NextResponse.json({ ok: false, error: 'device_models_load_failed' }, { status: 500 })
    }
    for (const c of mapRowsToCandidates(models as ModelRow[])) {
      modelLabelById.set(c.id, deviceModelCandidateLabel(c))
    }
  }

  const productsMissingTagAndModel = products.filter((p) => {
    return p.pricing_tag_id == null && (compatByProduct.get(p.id) ?? []).length === 0
  })

  const queryToProductIds = new Map<string, string[]>()
  for (const p of productsMissingTagAndModel) {
    const qs = buildDeviceModelSearchQueries(p.name, catalogKind)
    for (const q of qs) {
      if (q.length < 2) continue
      const list = queryToProductIds.get(q) ?? []
      if (!list.includes(p.id)) list.push(p.id)
      queryToProductIds.set(q, list)
    }
  }

  const candidateMaps = new Map<string, Map<string, DeviceModelCandidate>>()
  const addCandidates = (productId: string, rows: DeviceModelCandidate[]) => {
    const m = candidateMaps.get(productId) ?? new Map()
    for (const c of rows) m.set(c.id, c)
    candidateMaps.set(productId, m)
  }

  const uniqueQueries = [...queryToProductIds.keys()]
  const searchConcurrency = 10
  for (let i = 0; i < uniqueQueries.length; i += searchConcurrency) {
    const batch = uniqueQueries.slice(i, i + searchConcurrency)
    await Promise.all(
      batch.map(async (q) => {
        const safe = escapeIlikePattern(q)
        const limit = q.length <= 4 ? 36 : 22
        const { data, error } = await supabase
          .from('device_models')
          .select('id, model, device_types ( name, device_brands ( name ) )')
          .ilike('model', `%${safe}%`)
          .limit(limit)

        if (error) return
        const candidates = mapRowsToCandidates(data as ModelRow[])
        const pids = queryToProductIds.get(q) ?? []
        for (const pid of pids) {
          addCandidates(pid, candidates)
        }
      }),
    )
  }

  type OutRow = {
    productId: string
    name: string
    currentPricingTagId: string | null
    currentPricingTagName: string | null
    currentModelIds: string[]
    currentModelLabels: string[]
    suggestedPricingTagId: string | null
    suggestedPricingTagName: string | null
    suggestedModelId: string | null
    suggestedModelLabel: string | null
    canApply: boolean
  }

  const items: OutRow[] = []

  for (const p of productsMissingTagAndModel) {
    const tagHit = suggestPricingTagFromName(p.name, tags)
    const currentModelIds = [...new Set(compatByProduct.get(p.id) ?? [])]
    const currentModelLabels = currentModelIds.map((id) => modelLabelById.get(id) ?? id)

    const pool = [...(candidateMaps.get(p.id) ?? new Map()).values()]
    const bestModel = pool.length > 0
      ? pickBestDeviceModelForCatalogName(p.name, catalogKind, pool)
      : null

    const suggestedPricingTagId = tagHit?.id ?? null
    const suggestedPricingTagName = tagHit?.name ?? null
    const suggestedModelId = bestModel?.id ?? null
    const suggestedModelLabel = bestModel ? deviceModelCandidateLabel(bestModel) : null

    const curTag = p.pricing_tag_id
    const hasBothSuggestions = Boolean(suggestedPricingTagId && suggestedModelId)
    if (!hasBothSuggestions) continue

    const tagApply = Boolean(
      suggestedPricingTagId && suggestedPricingTagId !== curTag,
    )
    const modelApply = Boolean(
      suggestedModelId && !currentModelIds.includes(suggestedModelId),
    )
    const canApply = tagApply && modelApply

    items.push({
      productId: p.id,
      name: p.name,
      currentPricingTagId: curTag,
      currentPricingTagName: curTag ? (tagNameById.get(curTag) ?? null) : null,
      currentModelIds,
      currentModelLabels,
      suggestedPricingTagId,
      suggestedPricingTagName,
      suggestedModelId,
      suggestedModelLabel,
      canApply,
    })
  }

  items.sort((a, b) => {
    if (a.canApply !== b.canApply) return a.canApply ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  const res = NextResponse.json({
    ok: true,
    items,
    meta: {
      catalogKind,
      catalogItemsScanned: products.length,
      totalReturned: items.length,
    },
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
