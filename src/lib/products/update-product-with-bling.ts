import { blingProdutoApiPath, getBlingClientForCurrentUser, normalizeBlingProductId } from '@/lib/integrations/bling/api'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import {
  buildBlingPayloadFromPortalFieldsMask,
  buildBlingPayloadFromSnapshotDiff,
  createProductSyncSnapshot,
  type PortalFieldForBling,
} from '@/lib/products/bling-sync'
import {
  getProductById,
  updateProduct,
  type Product,
  type UpdateProductInput,
} from '@/lib/products/service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ProductMutationResult =
  | {
    ok: true
    product: Product
    syncedToBling: boolean
    /** Presente após PATCH no portal: o que mudou e pode ir ao Bling (custo não entra). */
    blingFieldsChanged?: PortalFieldForBling[]
  }
  | {
    ok: false
    error: string
    message?: string
  }

function blingRelevantChangedFields (
  before: Product,
  after: Product,
): PortalFieldForBling[] {
  const out: PortalFieldForBling[] = []
  if (before.name !== after.name) out.push('name')
  const descBefore = before.description ?? null
  const descAfter = after.description ?? null
  if (descBefore !== descAfter) out.push('description')
  if ((before.sku ?? null) !== (after.sku ?? null)) out.push('sku')
  if ((before.barcode ?? null) !== (after.barcode ?? null)) out.push('barcode')
  if (before.salePriceCents !== after.salePriceCents) {
    out.push('salePriceCents')
  }
  if (before.isActive !== after.isActive) out.push('isActive')
  return out
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

/**
 * Campos do produto que existem só no portal (não são enviados ao Bling).
 * Alterá-los não deve marcar `bling_sync_pending` nem sugerir “desincronizado”.
 */
const PRODUCT_PATCH_FIELDS_EXCLUDED_FROM_BLING_PENDING = new Set<keyof UpdateProductInput>([
  'pricingTagId',
  'imageUrl',
  'variationAttributeKeys',
  'variationAttributeValues',
  'costPriceCents',
  'costPriceManuallyEdited',
])

function isOnlyBlingExcludedProductPatch (patch: UpdateProductInput): boolean {
  const keys = (Object.keys(patch) as (keyof UpdateProductInput)[]).filter(
    (k) => patch[k] !== undefined,
  )
  if (keys.length === 0) return false
  return keys.every((k) => PRODUCT_PATCH_FIELDS_EXCLUDED_FROM_BLING_PENDING.has(k))
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

  if (input.imageUrl !== undefined) {
    patch.imageUrl = input.imageUrl === null ? null : normalizeText(String(input.imageUrl))
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

  if (input.pricingTagId !== undefined) {
    if (input.pricingTagId === null || String(input.pricingTagId).trim() === '') {
      patch.pricingTagId = null
    } else {
      const s = String(input.pricingTagId).trim().toLowerCase()
      if (!UUID_RE.test(s)) {
        return { ok: false as const, error: 'pricing_tag_invalid' }
      }
      patch.pricingTagId = s
    }
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
  const patch = { ...normalizedPatch.patch }
  // Qualquer PATCH explícito de custo (portal) deve atualizar `cost_price_manual_edited_at`,
  // senão `resolveListDisplayCostCents` pode continuar mostrando só a última entrada de estoque
  // mesmo com o cadastro já igual ao valor exibido (usuário acha que "não salvou").
  if (patch.costPriceCents !== undefined) {
    patch.costPriceManuallyEdited = true
  }

  const nextBlingSyncPending = !currentProduct.blingId
    ? false
    : isOnlyBlingExcludedProductPatch(patch)
      ? currentProduct.blingSyncPending
      : true

  const updatedResult = await updateProduct(id, {
    ...patch,
    blingSyncPending: nextBlingSyncPending,
  })

  if (!updatedResult.ok || !('product' in updatedResult)) {
    return { ok: false, error: 'error' in updatedResult ? updatedResult.error ?? 'db_error' : 'db_error' }
  }

  return {
    ok: true,
    product: updatedResult.product,
    syncedToBling: false,
    blingFieldsChanged: blingRelevantChangedFields(
      currentProduct,
      updatedResult.product,
    ),
  }
}

export type SyncProductToBlingOptions = {
  /** Se definido, PATCH no Bling só com estes campos (estado já salvo no portal). Omitir = diff completo (legado). */
  portalFieldsChanged?: PortalFieldForBling[] | null
}

export async function syncProductToBling (
  id: string,
  options?: SyncProductToBlingOptions,
): Promise<ProductMutationResult> {
  const currentResult = await getProductById(id)
  if (!currentResult.ok || !('product' in currentResult)) {
    return { ok: false, error: 'product_not_found' }
  }

  const currentProduct = currentResult.product
  if (!currentProduct.blingId) {
    return { ok: false, error: 'product_not_linked_bling' }
  }

  const blingProductId = normalizeBlingProductId(currentProduct.blingId)
  if (!blingProductId) {
    return { ok: false, error: 'bling_id_invalid', message: 'ID do Bling inválido no cadastro.' }
  }

  const clientResult = await getBlingClientForCurrentUser()
  if (!clientResult.ok || !('client' in clientResult)) {
    return { ok: false, error: 'error' in clientResult ? clientResult.error : 'bling_client_unavailable' }
  }

  const useFieldMask =
    options?.portalFieldsChanged !== undefined &&
    options.portalFieldsChanged !== null

  if (useFieldMask && options!.portalFieldsChanged!.length === 0) {
    const currentSnapshot = createProductSyncSnapshot(currentProduct)
    const clearedResult = await updateProduct(id, {
      blingSyncPending: false,
      blingSyncSnapshot: currentSnapshot,
    })
    if (!clearedResult.ok || !('product' in clearedResult)) {
      return { ok: false, error: 'error' in clearedResult ? clearedResult.error ?? 'db_error' : 'db_error' }
    }
    return {
      ok: true,
      product: clearedResult.product,
      syncedToBling: true,
    }
  }

  if (useFieldMask && options!.portalFieldsChanged!.length > 0) {
    const { payload: blingPayload, currentSnapshot } =
      buildBlingPayloadFromPortalFieldsMask(
        currentProduct,
        options!.portalFieldsChanged!,
      )
    if (Object.keys(blingPayload).length === 0) {
      const noPayloadResult = await updateProduct(id, {
        blingSyncPending: false,
        blingSyncSnapshot: currentSnapshot,
      })
      if (!noPayloadResult.ok || !('product' in noPayloadResult)) {
        return { ok: false, error: 'error' in noPayloadResult ? noPayloadResult.error ?? 'db_error' : 'db_error' }
      }
      return {
        ok: true,
        product: noPayloadResult.product,
        syncedToBling: true,
      }
    }

    try {
      await clientResult.client.request({
        method: 'PATCH',
        path: blingProdutoApiPath(blingProductId),
        body: blingPayload,
      })
    } catch (err) {
      return {
        ok: false,
        error: 'bling_request_failed',
        message: normalizeBlingSyncMessage(err instanceof Error ? err.message : 'unknown_error'),
      }
    }

    const afterPatchResult = await updateProduct(id, {
      blingSyncPending: false,
      blingSyncSnapshot: currentSnapshot,
    })
    if (!afterPatchResult.ok || !('product' in afterPatchResult)) {
      return { ok: false, error: 'error' in afterPatchResult ? afterPatchResult.error ?? 'db_error' : 'db_error' }
    }

    return {
      ok: true,
      product: afterPatchResult.product,
      syncedToBling: true,
    }
  }

  let baseSnapshot = currentProduct.blingSyncSnapshot

  if (!baseSnapshot) {
    try {
      const data = await clientResult.client.request<{
        data?: Record<string, unknown>
      } | Record<string, unknown>>({
        method: 'GET',
        path: blingProdutoApiPath(blingProductId),
      })

      baseSnapshot = createProductSyncSnapshot(
        mapBlingProductToLocal(data, blingProductId),
      )
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
      path: blingProdutoApiPath(blingProductId),
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
