import type { PortalFieldForBling } from '@/lib/products/bling-sync'
import {
  composePortalVariationDisplayName,
  parseVariationAttributeKeys,
  parseVariationAttributeValues,
} from '@/lib/products/variation-display-name'
import {
  getParentProductForVariation,
  getProductById,
  recomputeVariationDisplayNamesForParent,
  replaceProductCompatibleDeviceModels,
  type Product,
  type UpdateProductInput,
} from '@/lib/products/service'
import {
  syncProductToBling,
  updateProductAndSyncBling,
} from '@/lib/products/update-product-with-bling'
import { validateCestNcmPair } from '@/lib/fiscal/cest-lookup'
import { normalizeOptionalFci, originRequiresFci } from '@/lib/fiscal/fci'
import { normalizeOptionalGtin } from '@/lib/fiscal/gtin'
import { normalizeOptionalCest, normalizeOptionalNcm } from '@/lib/fiscal/ncm'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseTextField (body: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { hasValue: false as const }

  const value = body[key]
  if (value === null) {
    return { hasValue: true as const, value: null }
  }
  if (typeof value !== 'string') {
    return { hasValue: true as const, error: `${key}_invalid` }
  }

  return { hasValue: true as const, value }
}

function parseMoneyField (body: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { hasValue: false as const }

  const rawValue = body[key]
  if (rawValue === null || rawValue === '') {
    return { hasValue: true as const, value: null }
  }

  const numericValue = typeof rawValue === 'number'
    ? rawValue
    : typeof rawValue === 'string'
      ? Number(rawValue.replace(',', '.'))
      : Number.NaN

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { hasValue: true as const, error: `${key}_invalid` }
  }

  return {
    hasValue: true as const,
    value: Math.round(numericValue * 100),
  }
}

export type StaffProductPatchSuccess = {
  ok: true
  product: Product
  syncedToBling: boolean
  pendingSyncToBling: boolean
  blingFieldsChanged?: PortalFieldForBling[]
  message?: string
  syncError?: string
}

export type StaffProductPatchFailure = {
  ok: false
  error: string
  status: number
  message?: string
}

export type StaffProductPatchResult = StaffProductPatchSuccess | StaffProductPatchFailure

/**
 * Mesma semântica do PATCH /api/portal/produtos/[id] (staff/admin).
 * Usado pela rota unitária e pela edição em massa.
 */
export async function applyStaffProductPatchFromBody (
  productId: string,
  body: Record<string, unknown>,
): Promise<StaffProductPatchResult> {
  const id = String(productId || '').trim().toLowerCase()
  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'id_invalid', status: 400 }
  }

  const curRes = await getProductById(id)
  if (!curRes.ok || !('product' in curRes)) {
    return { ok: false, error: 'not_found', status: 404 }
  }
  const current = curRes.product

  const patch: UpdateProductInput = {}

  const salePriceField = parseMoneyField(body, 'salePrice')
  if ('error' in salePriceField) {
    return { ok: false, error: salePriceField.error, status: 400 }
  }
  if (salePriceField.hasValue) {
    patch.salePriceCents = salePriceField.value
  }

  const costPriceField = parseMoneyField(body, 'costPrice')
  if ('error' in costPriceField) {
    return { ok: false, error: costPriceField.error, status: 400 }
  }
  if (costPriceField.hasValue) {
    patch.costPriceCents = costPriceField.value
  }

  const nameField = parseTextField(body, 'name')
  if ('error' in nameField) {
    return { ok: false, error: nameField.error, status: 400 }
  }

  let skipExplicitName = false

  if (Object.prototype.hasOwnProperty.call(body, 'variationAttributeValues')) {
    const rawVals = body.variationAttributeValues
    if (rawVals !== null && (typeof rawVals !== 'object' || Array.isArray(rawVals))) {
      return { ok: false, error: 'variationAttributeValues_invalid', status: 400 }
    }
    if (current.parentBlingId == null) {
      return { ok: false, error: 'variationAttributeValues_not_allowed', status: 400 }
    }
    const partial = parseVariationAttributeValues(rawVals)
    const merged = { ...current.variationAttributeValues, ...partial }
    const parentRes = await getParentProductForVariation(current)
    if (parentRes.ok && parentRes.parent.variationAttributeKeys.length > 0) {
      patch.variationAttributeValues = merged
      patch.name = composePortalVariationDisplayName(
        parentRes.parent.name.trim(),
        parentRes.parent.variationAttributeKeys,
        merged,
      )
      skipExplicitName = true
    } else {
      patch.variationAttributeValues = partial
    }
  }

  if (!skipExplicitName && nameField.hasValue) {
    patch.name = nameField.value ?? ''
  }

  if (Object.prototype.hasOwnProperty.call(body, 'variationAttributeKeys')) {
    if (current.parentBlingId != null) {
      return { ok: false, error: 'variationAttributeKeys_not_allowed', status: 400 }
    }
    const rawKeys = body.variationAttributeKeys
    if (rawKeys !== null && !Array.isArray(rawKeys)) {
      return { ok: false, error: 'variationAttributeKeys_invalid', status: 400 }
    }
    patch.variationAttributeKeys = parseVariationAttributeKeys(rawKeys)
  }

  const skuField = parseTextField(body, 'sku')
  if ('error' in skuField) {
    return { ok: false, error: skuField.error, status: 400 }
  }
  if (skuField.hasValue) {
    patch.sku = skuField.value
  }

  const barcodeField = parseTextField(body, 'barcode')
  if ('error' in barcodeField) {
    return { ok: false, error: barcodeField.error, status: 400 }
  }
  if (barcodeField.hasValue) {
    const barcode = normalizeOptionalGtin(barcodeField.value)
    if (barcode === 'invalid') {
      return {
        ok: false,
        error: 'invalid_barcode',
        status: 400,
        message: 'Informe um EAN/GTIN válido (8, 12, 13 ou 14 dígitos) ou deixe em branco.',
      }
    }
    patch.barcode = barcode
  }

  const descriptionField = parseTextField(body, 'description')
  if ('error' in descriptionField) {
    return { ok: false, error: descriptionField.error, status: 400 }
  }
  if (descriptionField.hasValue) {
    patch.description = descriptionField.value
  }

  const imageUrlField = parseTextField(body, 'imageUrl')
  if ('error' in imageUrlField) {
    return { ok: false, error: imageUrlField.error, status: 400 }
  }
  if (imageUrlField.hasValue) {
    patch.imageUrl = imageUrlField.value
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { ok: false, error: 'isActive_invalid', status: 400 }
    }

    patch.isActive = body.isActive
  }

  if (Object.prototype.hasOwnProperty.call(body, 'kind')) {
    const kind = body.kind
    if (kind !== null && kind !== 'product' && kind !== 'service') {
      return { ok: false, error: 'kind_invalid', status: 400 }
    }

    patch.kind = kind as 'product' | 'service' | null
  }

  if (Object.prototype.hasOwnProperty.call(body, 'pricingTagId')) {
    const raw = body.pricingTagId
    if (raw === null || raw === '') {
      patch.pricingTagId = null
    } else {
      const s = String(raw).trim().toLowerCase()
      if (!UUID_RE.test(s)) {
        return { ok: false, error: 'pricingTagId_invalid', status: 400 }
      }
      patch.pricingTagId = s
    }
  }

  const ncmField = parseTextField(body, 'ncm')
  if ('error' in ncmField) {
    return { ok: false, error: ncmField.error, status: 400 }
  }
  if (ncmField.hasValue) {
    const ncm = normalizeOptionalNcm(ncmField.value)
    if (ncm === 'invalid') {
      return {
        ok: false,
        error: 'invalid_ncm',
        status: 400,
        message: 'Informe o NCM com 8 dígitos (0000.00.00) ou deixe em branco.',
      }
    }
    patch.ncm = ncm
  }

  const cestField = parseTextField(body, 'cest')
  if ('error' in cestField) {
    return { ok: false, error: cestField.error, status: 400 }
  }
  if (cestField.hasValue) {
    const cest = normalizeOptionalCest(cestField.value)
    if (cest === 'invalid') {
      return {
        ok: false,
        error: 'invalid_cest',
        status: 400,
        message: 'Informe o CEST com 7 dígitos (00.000.00) ou deixe em branco.',
      }
    }
    patch.cest = cest
  }

  if (patch.ncm !== undefined || patch.cest !== undefined) {
    const cestPair = await validateCestNcmPair(
      patch.ncm !== undefined ? patch.ncm : current.ncm,
      patch.cest !== undefined ? patch.cest : current.cest,
      current.name,
    )
    if (cestPair.ok === false) {
      return { ok: false, error: cestPair.error, status: 400, message: cestPair.message }
    }
  }

  for (const [bodyKey, patchKey] of [
    ['cfop', 'cfop'],
    ['fiscalUnit', 'fiscalUnit'],
    ['icmsCsosn', 'icmsCsosn'],
    ['icmsCst', 'icmsCst'],
    ['pisCst', 'pisCst'],
    ['cofinsCst', 'cofinsCst'],
  ] as const) {
    const field = parseTextField(body, bodyKey)
    if ('error' in field) {
      return { ok: false, error: field.error, status: 400 }
    }
    if (field.hasValue) {
      patch[patchKey] = field.value
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'fiscalOrigin')) {
    const raw = body.fiscalOrigin
    if (raw === null || raw === '') {
      patch.fiscalOrigin = null
    } else {
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0 || value > 8) {
        return { ok: false, error: 'fiscalOrigin_invalid', status: 400 }
      }
      patch.fiscalOrigin = Math.round(value)
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'fci')) {
    const raw = body.fci
    if (raw === null || raw === '') {
      patch.fci = null
    } else if (typeof raw !== 'string') {
      return { ok: false, error: 'fci_invalid', status: 400 }
    } else {
      const fci = normalizeOptionalFci(raw)
      if (fci === 'invalid') {
        return {
          ok: false,
          error: 'invalid_fci',
          status: 400,
          message: 'Informe o FCI no formato UUID (8-4-4-4-12) ou deixe em branco.',
        }
      }
      patch.fci = fci
    }
  }

  if (
    patch.fiscalOrigin !== undefined &&
    !originRequiresFci(patch.fiscalOrigin)
  ) {
    patch.fci = null
  }

  let compatibleIds: string[] | null = null
  if (Object.prototype.hasOwnProperty.call(body, 'compatibleModelIds')) {
    const raw = body.compatibleModelIds
    if (!Array.isArray(raw)) {
      return { ok: false, error: 'compatibleModelIds_invalid', status: 400 }
    }
    compatibleIds = [
      ...new Set(
        raw
          .map((x) => String(x || '').trim().toLowerCase())
          .filter((x) => UUID_RE.test(x)),
      ),
    ]
  }

  const wantSyncToBling = body.syncToBling === true

  const hasProductPatch = Object.keys(patch).length > 0
  const hasCompatUpdate = compatibleIds !== null

  if (!hasProductPatch && !hasCompatUpdate) {
    return { ok: false, error: 'nothing_to_update', status: 400 }
  }

  let syncedToBling = false
  let blingFieldsChanged: PortalFieldForBling[] | undefined
  let midProduct: Product

  if (hasProductPatch) {
    const upd = await updateProductAndSyncBling(id, patch)
    if (!upd.ok && 'error' in upd) {
      const status = upd.error === 'bling_request_failed' ? 502 : 400
      return {
        ok: false,
        error: upd.error,
        status,
        message: upd.message,
      }
    }
    if (!upd.ok) {
      return { ok: false, error: 'db_error', status: 400 }
    }
    syncedToBling = upd.syncedToBling
    blingFieldsChanged = upd.blingFieldsChanged
    midProduct = upd.product
    if (patch.variationAttributeKeys !== undefined && current.parentBlingId == null) {
      const rec = await recomputeVariationDisplayNamesForParent(id)
      if (rec.ok === false) {
        return { ok: false, error: rec.error, status: 500 }
      }
    }
  } else {
    midProduct = current
  }

  if (hasCompatUpdate && compatibleIds) {
    const rep = await replaceProductCompatibleDeviceModels(id, compatibleIds)
    if (!rep.ok) {
      return { ok: false, error: 'compatible_models_failed', status: 500 }
    }
  }

  const fresh = await getProductById(id)
  let productOut = fresh.ok && 'product' in fresh ? fresh.product : midProduct

  if (wantSyncToBling && productOut.blingId) {
    const sync = await syncProductToBling(id, {
      portalFieldsChanged: blingFieldsChanged ?? [],
    })
    if (!sync.ok) {
      return {
        ok: true,
        product: productOut,
        syncedToBling: false,
        pendingSyncToBling: true,
        blingFieldsChanged,
        syncError: 'error' in sync ? sync.error : 'db_error',
        message: 'error' in sync ? sync.message : undefined,
      }
    }
    syncedToBling = sync.syncedToBling
    productOut = sync.product
  }

  return {
    ok: true,
    product: productOut,
    syncedToBling,
    pendingSyncToBling: productOut.blingSyncPending,
    blingFieldsChanged,
  }
}
