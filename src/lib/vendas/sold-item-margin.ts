/**
 * Margem de item vendido (aba Vendas «Por produtos»).
 * Custo: unitário efetivo da linha se > 0; senão custo do produto se > 0; senão 0 (exibição).
 */

export type SoldItemMarginInput = {
  quantity: number
  subtotalCents: number
  /** Custo unitário gravado na linha da venda. */
  lineUnitCostCents: number | null | undefined
  /** Custo unitário do produto vinculado (null se sem produto). */
  productCostCents: number | null | undefined
  /** Tem produto vinculado na plataforma. */
  hasProduct: boolean
  /** Taxa de pagamento alocada a este item (centavos). */
  allocatedFeeCents: number
}

export type SoldItemMargin = {
  revenueCents: number
  /**
   * Custo unitário cadastrado (linha ou produto); null = não definido (UI ainda mostra total 0).
   */
  effectiveUnitCostCents: number | null
  costTotalCents: number
  grossMarginCents: number
  feeCents: number
  netMarginCents: number
  netMarginPercent: number | null
  canEditCost: boolean
}

function toNonNegInt (value: unknown): number {
  const n = Math.trunc(Number(value) || 0)
  return n > 0 ? n : 0
}

/**
 * Resolve custo unitário efetivo cadastrado.
 * - Sem produto → null
 * - Com produto: linha > 0, senão produto > 0, senão null (trata como 0 no cálculo)
 */
export function resolveEffectiveUnitCostCents (input: {
  hasProduct: boolean
  lineUnitCostCents: number | null | undefined
  productCostCents: number | null | undefined
}): number | null {
  if (!input.hasProduct) return null
  const line = toNonNegInt(input.lineUnitCostCents)
  if (line > 0) return line
  const product = toNonNegInt(input.productCostCents)
  if (product > 0) return product
  return null
}

export function computeSoldItemMargin (input: SoldItemMarginInput): SoldItemMargin {
  const qty = Math.max(1, toNonNegInt(input.quantity) || 1)
  const revenueCents = Math.max(0, Math.trunc(Number(input.subtotalCents) || 0))
  const feeCents = Math.max(0, Math.trunc(Number(input.allocatedFeeCents) || 0))
  const effectiveUnitCostCents = resolveEffectiveUnitCostCents({
    hasProduct: input.hasProduct,
    lineUnitCostCents: input.lineUnitCostCents,
    productCostCents: input.productCostCents,
  })

  const unitForTotal = effectiveUnitCostCents ?? 0
  const costTotalCents = unitForTotal * qty
  const grossMarginCents = revenueCents - costTotalCents
  const netMarginCents = grossMarginCents - feeCents
  const netMarginPercent =
    revenueCents > 0 ? (netMarginCents / revenueCents) * 100 : null

  return {
    revenueCents,
    effectiveUnitCostCents,
    costTotalCents,
    grossMarginCents,
    feeCents,
    netMarginCents,
    netMarginPercent,
    canEditCost: input.hasProduct,
  }
}

/**
 * Aloca a taxa total do pedido entre itens na proporção do subtotal.
 * O resto de arredondamento vai para o item de maior subtotal.
 */
export function allocateOrderFeeToItems (
  orderFeeCents: number,
  itemSubtotalsCents: number[],
): number[] {
  const fee = Math.max(0, Math.trunc(orderFeeCents) || 0)
  const n = itemSubtotalsCents.length
  if (n === 0) return []
  if (fee === 0) return itemSubtotalsCents.map(() => 0)

  const totalSub = itemSubtotalsCents.reduce(
    (acc, s) => acc + Math.max(0, Math.trunc(s) || 0),
    0,
  )
  if (totalSub <= 0) {
    const even = Math.floor(fee / n)
    const out = itemSubtotalsCents.map(() => even)
    out[0] += fee - even * n
    return out
  }

  const allocated = itemSubtotalsCents.map((s) => {
    const sub = Math.max(0, Math.trunc(s) || 0)
    return Math.floor((fee * sub) / totalSub)
  })
  let remainder = fee - allocated.reduce((a, b) => a + b, 0)
  if (remainder > 0) {
    let maxIdx = 0
    for (let i = 1; i < n; i++) {
      if ((itemSubtotalsCents[i] || 0) > (itemSubtotalsCents[maxIdx] || 0)) {
        maxIdx = i
      }
    }
    allocated[maxIdx] += remainder
  }
  return allocated
}
