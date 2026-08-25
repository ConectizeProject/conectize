import { formatMoneyInputBr } from '@/lib/utils/format-money'

export type QuoteItemDb = {
  kind?: 'service' | 'product' | null
  description?: string | null
  quantity?: number | null
  unitValueCents?: number | null
  unitCostCents?: number | null
  valueCents?: number | null
  costCents?: number | null
  sourceProductId?: string | null
  noCost?: boolean | null
}

export function parseQuoteItemsRaw (raw: unknown): QuoteItemDb[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : []
    return items.slice(0, 100).map((item) => {
      const i = item as Record<string, unknown>
      return {
        kind: i.kind === 'product' ? 'product' : 'service',
        description: String(i.description ?? '').trim(),
        quantity: Number(i.quantity) || 1,
        unitValueCents: Math.max(0, Number(i.unitValueCents ?? i.valueCents ?? 0) || 0),
        unitCostCents: Math.max(0, Number(i.unitCostCents ?? i.costCents ?? 0) || 0),
        valueCents: Math.max(0, Number(i.valueCents ?? 0) || 0),
        costCents: Math.max(0, Number(i.costCents ?? 0) || 0),
        sourceProductId: i.sourceProductId != null ? String(i.sourceProductId) : null,
        noCost: i.noCost === true,
      }
    })
  } catch {
    return []
  }
}

export function quoteItemToFormLine (item: QuoteItemDb, index: number) {
  const kind = item.kind === 'product' ? 'product' : 'service'
  const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
  const unitValue = Math.max(0, Number(item.unitValueCents ?? item.valueCents ?? 0) || 0)
  const unitCost = Math.max(0, Number(item.unitCostCents ?? item.costCents ?? 0) || 0)
  return {
    id: `quote-item-${index}`,
    kind: kind as 'service' | 'product',
    description: String(item.description || ''),
    quantity: String(quantity),
    value: unitValue > 0 ? formatMoneyInputBr(String(unitValue)) : '',
    cost: unitCost > 0 ? formatMoneyInputBr(String(unitCost)) : '',
    sourceProductId: item.sourceProductId || null,
    noCost: item.noCost === true,
  }
}
