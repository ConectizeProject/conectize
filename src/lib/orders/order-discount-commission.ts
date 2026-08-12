export type OrderDiscountMode = 'fixed' | 'percent'
export type OrderCommissionKind = 'fixed' | 'percent'

export type OrderDiscountCommissionValues = {
  discountMode: OrderDiscountMode
  discountFixedCents: number
  discountPercent: number
  commissionEnabled: boolean
  commissionUserId: string
  commissionKind: OrderCommissionKind
  commissionFixedCents: number
  commissionPercent: number
}

export const EMPTY_ORDER_DISCOUNT_COMMISSION: OrderDiscountCommissionValues = {
  discountMode: 'fixed',
  discountFixedCents: 0,
  discountPercent: 0,
  commissionEnabled: false,
  commissionUserId: '',
  commissionKind: 'percent',
  commissionFixedCents: 0,
  commissionPercent: 0,
}

export function resolveOrderDiscountCents (
  servicesTotalCents: number,
  mode: OrderDiscountMode,
  fixedCents: number,
  percent: number,
): number {
  const base = Math.max(0, Math.trunc(servicesTotalCents) || 0)
  if (mode === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(percent) || 0))
    return Math.min(base, Math.round(base * pct / 100))
  }
  return Math.min(base, Math.max(0, Math.trunc(fixedCents) || 0))
}

export function resolveOrderPayableCents (
  servicesTotalCents: number,
  discountCents: number,
): number {
  return Math.max(0, (Math.trunc(servicesTotalCents) || 0) - (Math.trunc(discountCents) || 0))
}

export type OrderDiscountCommissionDbPayload = {
  discount_cents: number
  discount_mode: OrderDiscountMode
  discount_percent: number | null
  commission_user_id: string | null
  commission_kind: OrderCommissionKind | null
  commission_fixed_cents: number | null
  commission_percent: number | null
}

export function toOrderDiscountCommissionDbPayload (
  values: OrderDiscountCommissionValues,
  servicesTotalCents: number,
): OrderDiscountCommissionDbPayload {
  const discountCents = resolveOrderDiscountCents(
    servicesTotalCents,
    values.discountMode,
    values.discountFixedCents,
    values.discountPercent,
  )

  if (!values.commissionEnabled || !values.commissionUserId.trim()) {
    return {
      discount_cents: discountCents,
      discount_mode: values.discountMode,
      discount_percent: values.discountMode === 'percent' ? values.discountPercent : null,
      commission_user_id: null,
      commission_kind: null,
      commission_fixed_cents: null,
      commission_percent: null,
    }
  }

  return {
    discount_cents: discountCents,
    discount_mode: values.discountMode,
    discount_percent: values.discountMode === 'percent' ? values.discountPercent : null,
    commission_user_id: values.commissionUserId.trim(),
    commission_kind: values.commissionKind,
    commission_fixed_cents:
      values.commissionKind === 'fixed' ? Math.max(0, values.commissionFixedCents) : null,
    commission_percent:
      values.commissionKind === 'percent' ? Math.max(0, values.commissionPercent) : null,
  }
}

function parsePercent (raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(100, n)
}

/**
 * Lê desconto/comissão do FormData (inputs hidden ou Formik → FormData).
 */
export function parseOrderDiscountCommissionFromFormData (
  formData: FormData,
): OrderDiscountCommissionValues {
  const discountModeRaw = String(formData.get('discountMode') || 'fixed').trim()
  const discountMode: OrderDiscountMode = discountModeRaw === 'percent' ? 'percent' : 'fixed'
  const discountFixedCents = Math.max(0, Number(formData.get('discountFixedCents')) || 0)
  const discountPercent = parsePercent(formData.get('discountPercent'))
  const commissionEnabled = String(formData.get('commissionEnabled') || '') === '1'
  const commissionUserId = String(formData.get('commissionUserId') || '').trim()
  const commissionKindRaw = String(formData.get('commissionKind') || 'percent').trim()
  const commissionKind: OrderCommissionKind =
    commissionKindRaw === 'fixed' ? 'fixed' : 'percent'
  const commissionFixedCents = Math.max(0, Number(formData.get('commissionFixedCents')) || 0)
  const commissionPercent = parsePercent(formData.get('commissionPercent'))

  return {
    discountMode,
    discountFixedCents,
    discountPercent,
    commissionEnabled,
    commissionUserId,
    commissionKind,
    commissionFixedCents,
    commissionPercent,
  }
}

/**
 * Hidrata valores a partir da linha de service_orders.
 */
export function parseOrderDiscountCommissionFromRow (
  order: Record<string, unknown> | null | undefined | object,
): OrderDiscountCommissionValues {
  if (!order) return { ...EMPTY_ORDER_DISCOUNT_COMMISSION }
  const row = order as Record<string, unknown>

  const discountModeRaw = String(row.discount_mode || 'fixed').trim()
  const discountMode: OrderDiscountMode = discountModeRaw === 'percent' ? 'percent' : 'fixed'
  const discountFixedCents = Math.max(0, Number(row.discount_cents) || 0)
  const discountPercent = parsePercent(row.discount_percent)
  const commissionUserId = String(row.commission_user_id || '').trim()
  const commissionKindRaw = String(row.commission_kind || 'percent').trim()
  const commissionKind: OrderCommissionKind =
    commissionKindRaw === 'fixed' ? 'fixed' : 'percent'

  return {
    discountMode,
    discountFixedCents,
    discountPercent,
    commissionEnabled: Boolean(commissionUserId),
    commissionUserId,
    commissionKind,
    commissionFixedCents: Math.max(0, Number(row.commission_fixed_cents) || 0),
    commissionPercent: parsePercent(row.commission_percent),
  }
}
