import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import {
  buildBlingPayloadFromSnapshotDiff,
  createProductSyncSnapshot,
} from '@/lib/products/bling-sync'
import {
  getProductById,
  updateProduct,
  type Product,
  type ProductSyncSnapshot,
  type UpdateProductInput,
} from '@/lib/products/service'

type ProductMutationResult =
  | {
    ok: true
    product: Product
    syncedToBling: boolean
  }
  | {
    ok: false
    error: string
    message?: string
  }

type NormalizePatchResult =
  | {
    ok: true
    patch: UpdateProductInput
  }
  | {
    ok: false
    error: string
  }

function normalizeBlingSyncMessage (message: string | undefined) {
  if (!message) return undefined

  if (message === 'insufficient_scope') {
    return 'A conta do Bling conectada não tem permissão para atualizar produtos. Ajuste os escopos do aplicativo no Bling e reconecte a conta no HUB.'
  }

  return message
}

function normalizeText (value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return null

  const normalizedValue = String(value).trim()
  return normalizedValue || null
}

function normalizePatch (input: UpdateProductInput): NormalizePatchResult {
  const patch: UpdateProductInput = {}

  if (input.name !== undefined) {
    const normalizedName = String(input.name || '').trim()
    if (!normalizedName) {
      return { ok: false as const, error: 'name_required' }
    }

    patch.name = normalizedName
  }

  if (input.sku !== undefined) {
    patch.sku = normalizeText(input.sku)
  }

  if (input.barcode !== undefined) {
    patch.barcode = normalizeText(input.barcode)
  }

  if (input.description !== undefined) {
    patch.description = normalizeText(input.description)
  }

  if (input.salePriceCents !== undefined) {
    if (input.salePriceCents !== null && (!Number.isFinite(input.salePriceCents) || input.salePriceCents < 0)) {
      return { ok: false as const, error: 'sale_price_invalid' }
    }

    patch.salePriceCents = input.salePriceCents
  }

  if (input.costPriceCents !== undefined) {
    if (input.costPriceCents !== null && (!Number.isFinite(input.costPriceCents) || input.costPriceCents < 0)) {
      return { ok: false as const, error: 'cost_price_invalid' }
    }

    patch.costPriceCents = input.costPriceCents
  }

  if (input.isActive !== undefined) {
    patch.isActive = Boolean(input.isActive)
  }

  if (input.kind !== undefined) {
    if (input.kind !== null && input.kind !== 'product' && input.kind !== 'service') {
      return { ok: false as const, error: 'kind_invalid' }
    }

    patch.kind = input.kind
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, error: 'nothing_to_update' }
  }

  return { ok: true as const, patch }
}

export async function updateProductAndSyncBling (
  id: string,
  input: UpdateProductInput,
): Promise<ProductMutationResult> {
  const normalizedPatch = normalizePatch(input)
  if ('error' in normalizedPatch) {
    return { ok: false, error: normalizedPatch.error }
  }

  const currentResult = await getProductById(id)
  if (!currentResult.ok || !('product' in currentResult)) {
    return { ok: false, error: 'product_not_found' }
  }

  const currentProduct = currentResult.product
  const updatedResult = await updateProduct(id, {
    ...normalizedPatch.patch,
    blingSyncPending: Boolean(currentProduct.blingId),
  })

  if (!updatedResult.ok || !('product' in updatedResult)) {
    return { ok: false, error: 'error' in updatedResult ? updatedResult.error ?? 'db_error' : 'db_error' }
  }

  return {
    ok: true,
    product: updatedResult.product,
    syncedToBling: false,
  }
}

export async function syncProductToBling (
  id: string,
): Promise<ProductMutationResult> {
  const currentResult = await getProductById(id)
  if (!currentResult.ok || !('product' in currentResult)) {
    return { ok: false, error: 'product_not_found' }
  }

  const currentProduct = currentResult.product
  if (!currentProduct.blingId) {
    return { ok: false, error: 'product_not_linked_bling' }
  }

  const clientResult = await getBlingClientForCurrentUser()
  if (!clientResult.ok || !('client' in clientResult)) {
    return { ok: false, error: 'error' in clientResult ? clientResult.error : 'bling_client_unavailable' }
  }

  let baseSnapshot = currentProduct.blingSyncSnapshot

  if (!baseSnapshot) {
    try {
      const data = await clientResult.client.request<{
        data?: Record<string, unknown>
      } | Record<string, unknown>>({
        method: 'GET',
        path: `/produtos/${currentProduct.blingId}`,
      })

      const dto = data?.data ?? data ?? {}
      baseSnapshot = createProductSyncSnapshot(mapBlingProductToLocal(dto))
    } catch (err) {
      return {
        ok: false,
        error: 'bling_request_failed',
        message: normalizeBlingSyncMessage(err instanceof Error ? err.message : 'unknown_error'),
      }
    }
  }

  const {
    payload: blingPayload,
    currentSnapshot,
    hasChanges,
  } = buildBlingPayloadFromSnapshotDiff(currentProduct, baseSnapshot)

  if (!hasChanges) {
    const unchangedResult = await updateProduct(id, {
      blingSyncPending: false,
      blingSyncSnapshot: currentSnapshot,
    })

    if (!unchangedResult.ok || !('product' in unchangedResult)) {
      return { ok: false, error: 'error' in unchangedResult ? unchangedResult.error ?? 'db_error' : 'db_error' }
    }

    return {
      ok: true,
      product: unchangedResult.product,
      syncedToBling: true,
    }
  }

  try {
    await clientResult.client.request({
      method: 'PATCH',
      path: `/produtos/${currentProduct.blingId}`,
      body: blingPayload,
    })
  } catch (err) {
    return {
      ok: false,
      error: 'bling_request_failed',
      message: normalizeBlingSyncMessage(err instanceof Error ? err.message : 'unknown_error'),
    }
  }

  const updatedResult = await updateProduct(id, {
    blingSyncPending: false,
    blingSyncSnapshot: currentSnapshot,
  })
  if (!updatedResult.ok || !('product' in updatedResult)) {
    return { ok: false, error: 'error' in updatedResult ? updatedResult.error ?? 'db_error' : 'db_error' }
  }

  return {
    ok: true,
    product: updatedResult.product,
    syncedToBling: true,
  }
}
