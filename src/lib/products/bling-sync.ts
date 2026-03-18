import { mapLocalProductToBling, type LocalProduct } from '@/lib/integrations/bling/mappers'
import type { Product, ProductSyncSnapshot } from '@/lib/products/service'

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

  if (!baseSnapshot || baseSnapshot.costPriceCents !== currentSnapshot.costPriceCents) {
    localPatch.costPriceCents = currentSnapshot.costPriceCents
  }

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
