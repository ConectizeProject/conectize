import { mapLocalProductToBling, type LocalProduct } from '@/lib/integrations/bling/mappers'
import type { Product, ProductSyncSnapshot } from '@/lib/products/service'

/** Campos do portal que podem ser refletidos no PATCH do Bling (custo fica só no Conectize). */
export type PortalFieldForBling =
  | 'name'
  | 'description'
  | 'sku'
  | 'barcode'
  | 'salePriceCents'
  | 'isActive'

type SyncComparableProduct = {
  name: string
  sku?: string | null
  barcode?: string | null
  description?: string | null
  salePriceCents?: number | null
  costPriceCents?: number | null
  isActive?: boolean
  kind?: 'product' | 'service' | null
}

function normalizeText (value: string | null | undefined) {
  if (value == null) return null
  const normalizedValue = String(value).trim()
  return normalizedValue || null
}

export function createProductSyncSnapshot (product: SyncComparableProduct): ProductSyncSnapshot {
  return {
    name: String(product.name || '').trim(),
    sku: normalizeText(product.sku),
    barcode: normalizeText(product.barcode),
    description: normalizeText(product.description),
    salePriceCents: typeof product.salePriceCents === 'number' ? product.salePriceCents : null,
    costPriceCents: typeof product.costPriceCents === 'number' ? product.costPriceCents : null,
    isActive: product.isActive !== false,
    kind: product.kind === 'service' ? 'service' : product.kind === 'product' ? 'product' : null,
  }
}

export function buildBlingPayloadFromSnapshotDiff (
  currentProduct: Pick<Product, 'name' | 'sku' | 'barcode' | 'description' | 'salePriceCents' | 'costPriceCents' | 'isActive' | 'kind'>,
  baseSnapshot: ProductSyncSnapshot | null,
) {
  const currentSnapshot = createProductSyncSnapshot(currentProduct)
  const localPatch: LocalProduct = {
    name: currentSnapshot.name,
  }

  if (!baseSnapshot || baseSnapshot.name !== currentSnapshot.name) {
    localPatch.name = currentSnapshot.name
  } else {
    delete localPatch.name
  }

  if (!baseSnapshot || baseSnapshot.sku !== currentSnapshot.sku) {
    localPatch.sku = currentSnapshot.sku
  }

  if (!baseSnapshot || baseSnapshot.barcode !== currentSnapshot.barcode) {
    localPatch.barcode = currentSnapshot.barcode
  }

  if (!baseSnapshot || baseSnapshot.description !== currentSnapshot.description) {
    localPatch.description = currentSnapshot.description
  }

  if (!baseSnapshot || baseSnapshot.salePriceCents !== currentSnapshot.salePriceCents) {
    localPatch.salePriceCents = currentSnapshot.salePriceCents
  }

  /** Custo é só do portal (CMV / última entrada); não enviamos `custo`/`precoCusto` no PATCH do Bling. */

  if (!baseSnapshot || baseSnapshot.isActive !== currentSnapshot.isActive) {
    localPatch.isActive = currentSnapshot.isActive
  }

  const payload = mapLocalProductToBling(localPatch)

  // O Bling costuma rejeitar alteração de tipo em itens já existentes.
  delete payload.tipo

  return {
    payload,
    currentSnapshot,
    hasChanges: Object.keys(payload).length > 0,
  }
}

/**
 * Monta o PATCH do Bling só com o que já foi persistido no portal nesta edição.
 * `name` no tipo LocalProduct é obrigatório: usamos string vazia quando o nome não vai no PATCH.
 */
export function buildBlingPayloadFromPortalFieldsMask (
  product: Pick<
    Product,
    'name' | 'sku' | 'barcode' | 'description' | 'salePriceCents' | 'isActive' | 'kind'
  >,
  fields: PortalFieldForBling[],
): { payload: Record<string, unknown>; currentSnapshot: ProductSyncSnapshot } {
  const set = new Set(fields)
  const localPatch: LocalProduct = {
    name: set.has('name') ? product.name : '',
  }

  if (set.has('sku')) localPatch.sku = product.sku
  if (set.has('barcode')) localPatch.barcode = product.barcode
  if (set.has('description')) localPatch.description = product.description
  if (set.has('salePriceCents')) {
    localPatch.salePriceCents = product.salePriceCents
  }
  if (set.has('isActive')) localPatch.isActive = product.isActive

  const payload = mapLocalProductToBling(localPatch)
  delete payload.tipo

  const currentSnapshot = createProductSyncSnapshot(product)

  return {
    payload,
    currentSnapshot,
  }
}

export function isPortalFieldForBling (value: unknown): value is PortalFieldForBling {
  return (
    value === 'name' ||
    value === 'description' ||
    value === 'sku' ||
    value === 'barcode' ||
    value === 'salePriceCents' ||
    value === 'isActive'
  )
}
