import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { mapLocalProductToBling } from '@/lib/integrations/bling/mappers'
import {
  getProductById,
  updateProduct,
  type Product,
  type UpdateProductInput,
} from '@/lib/products/service'

type UpdateProductAndSyncResult =
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

function mergeProduct (currentProduct: Product, patch: UpdateProductInput) {
  return {
    blingId: currentProduct.blingId,
    kind: patch.kind !== undefined ? patch.kind : currentProduct.kind ?? null,
    name: patch.name !== undefined ? patch.name : currentProduct.name,
    sku: patch.sku !== undefined ? patch.sku : currentProduct.sku,
    barcode: patch.barcode !== undefined ? patch.barcode : currentProduct.barcode,
    description: patch.description !== undefined ? patch.description : currentProduct.description,
    salePriceCents: patch.salePriceCents !== undefined ? patch.salePriceCents : currentProduct.salePriceCents,
    costPriceCents: patch.costPriceCents !== undefined ? patch.costPriceCents : currentProduct.costPriceCents,
    isActive: patch.isActive !== undefined ? patch.isActive : currentProduct.isActive,
  }
}

export async function updateProductAndSyncBling (
  id: string,
  input: UpdateProductInput,
): Promise<UpdateProductAndSyncResult> {
  const normalizedPatch = normalizePatch(input)
  if ('error' in normalizedPatch) {
    return { ok: false, error: normalizedPatch.error }
  }

  const currentResult = await getProductById(id)
  if (!currentResult.ok || !('product' in currentResult)) {
    return { ok: false, error: 'product_not_found' }
  }

  const currentProduct = currentResult.product

  if (currentProduct.blingId) {
    const clientResult = await getBlingClientForCurrentUser()
    if (!clientResult.ok || !('client' in clientResult)) {
      return { ok: false, error: 'error' in clientResult ? clientResult.error : 'bling_client_unavailable' }
    }

    try {
      await clientResult.client.request({
        method: 'PUT',
        path: `/produtos/${currentProduct.blingId}`,
        body: mapLocalProductToBling(mergeProduct(currentProduct, normalizedPatch.patch)),
      })
    } catch (err) {
      return {
        ok: false,
        error: 'bling_request_failed',
        message: normalizeBlingSyncMessage(err instanceof Error ? err.message : 'unknown_error'),
      }
    }
  }

  const updatedResult = await updateProduct(id, normalizedPatch.patch)
  if (!updatedResult.ok || !('product' in updatedResult)) {
    return { ok: false, error: 'error' in updatedResult ? updatedResult.error ?? 'db_error' : 'db_error' }
  }

  return {
    ok: true,
    product: updatedResult.product,
    syncedToBling: Boolean(currentProduct.blingId),
  }
}
