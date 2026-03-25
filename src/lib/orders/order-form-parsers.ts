import {
  orderFormPaymentMethodsJsonRootSchema,
  orderFormServicesJsonPayloadSchema,
} from '@/lib/orders/order-form-json-schemas'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export type OrderFormPaymentMethodRow = {
  payment_method_id: string
  installments?: number
  value_cents?: number | null
}

export type OrderFormServiceLine = {
  kind: 'service' | 'product'
  description: string
  quantity: number
  unitValueCents: number
  unitCostCents: number
  valueCents: number
  costCents: number
  sourceProductId: string | null
}

export type ParseServicesFromFormJsonResult = {
  items: OrderFormServiceLine[]
  totalValueCents: number
  totalCostCents: number
}

const EMPTY_SERVICES: ParseServicesFromFormJsonResult = {
  items: [],
  totalValueCents: 0,
  totalCostCents: 0,
}

/**
 * Array de formas de pagamento enviado pelo formulário (JSON no FormData).
 */
export function parsePaymentMethodsJson (raw: unknown): OrderFormPaymentMethodRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(String(raw))
    const root = orderFormPaymentMethodsJsonRootSchema.safeParse(parsed)
    if (!root.success) return []
    return root.data
      .filter(
        (item: unknown) =>
          item && typeof item === 'object' && (item as { payment_method_id?: unknown }).payment_method_id,
      )
      .map((item: unknown) => {
        const row = item as {
          payment_method_id?: unknown
          installments?: unknown
          value_cents?: unknown
        }
        const id = parseOptionalUuid(row.payment_method_id)
        if (!id) return null
        return {
          payment_method_id: id,
          installments:
            row.installments != null
              ? Math.max(1, Math.min(24, Number(row.installments) || 1))
              : undefined,
          value_cents:
            row.value_cents != null
              ? Math.max(0, Number(row.value_cents) || 0)
              : null,
        }
      })
      .filter(Boolean) as OrderFormPaymentMethodRow[]
  } catch {
    return []
  }
}

/**
 * Itens de serviço/produto + totais enviados pelo formulário (JSON no FormData).
 * JSON inválido ou ausente retorna lista vazia (não lança).
 */
export function parseServicesJson (raw: unknown): ParseServicesFromFormJsonResult {
  if (!raw) return { ...EMPTY_SERVICES }
  try {
    const parsed = JSON.parse(String(raw))
    const base = orderFormServicesJsonPayloadSchema.safeParse(parsed)
    if (!base.success) return { ...EMPTY_SERVICES }
    const payload = base.data
    const items = Array.isArray(payload.items) ? payload.items : []
    const normalized = items
      .slice(0, 100)
      .map((item: unknown) => {
        const i = item as Record<string, unknown>
        const kind: 'service' | 'product' = i.kind === 'product' ? 'product' : 'service'
        const description = String(i?.description ?? '')
          .trim()
          .slice(0, 240)
        const quantityRaw =
          kind === 'product'
            ? Number.parseInt(String(i?.quantity ?? '1'), 10)
            : 1
        const quantity =
          Number.isFinite(quantityRaw) && quantityRaw > 0
            ? Math.min(9999, Math.max(1, quantityRaw))
            : 1
        const unitValueCentsRaw = i.unitValueCents ?? i.valueCents ?? 0
        const unitCostCentsRaw = i.unitCostCents ?? i.costCents ?? 0
        const unitValueCents = Math.max(0, Number(unitValueCentsRaw ?? 0) || 0)
        const unitCostCents = Math.max(0, Number(unitCostCentsRaw ?? 0) || 0)
        const valueCents = unitValueCents * quantity
        const costCents = unitCostCents * quantity
        const sourceProductId = parseOptionalUuid(i.sourceProductId)
        return {
          kind,
          description,
          quantity,
          unitValueCents,
          unitCostCents,
          valueCents,
          costCents,
          sourceProductId,
        }
      })
      .filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)
    const totalValueCents = normalized.reduce((acc, s) => acc + s.valueCents, 0)
    const totalCostCents = normalized.reduce((acc, s) => acc + s.costCents, 0)
    return { items: normalized, totalValueCents, totalCostCents }
  } catch {
    return { ...EMPTY_SERVICES }
  }
}
