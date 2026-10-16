/**
 * Margem de item vendido (aba Vendas «Por produtos»).
 * Lucro bruto = receita − frete − tarifas.
 * Margem de contribuição = lucro bruto − custo − imposto (se NFC/NF).
 */

export type SoldItemFeeDetail = {
  label: string
  amountCents: number
}

export type SoldItemMarginInput = {
  quantity: number
  subtotalCents: number
  /** Custo unitário gravado na linha da venda. */
  lineUnitCostCents: number | null | undefined
  /** Custo unitário do produto vinculado (null se sem produto). */
  productCostCents: number | null | undefined
  /** Tem produto vinculado na plataforma. */
  hasProduct: boolean
  /** Frete alocado a este item (centavos). */
  allocatedShippingCents?: number
  /** Taxa de pagamento alocada a este item (centavos). */
  allocatedFeeCents: number
  /** Detalhe das tarifas para tooltip (valores já alocados ao item). */
  feeDetails?: SoldItemFeeDetail[]
  /** Alíquota média da empresa (%). Só aplicada se hasAuthorizedFiscalDoc. */
  marginTaxPercent?: number
  /** Pedido tem NFC-e ou NF-e autorizada. */
  hasAuthorizedFiscalDoc?: boolean
}

export type SoldItemMargin = {
  revenueCents: number
  shippingCents: number
  feeCents: number
  feeDetails: SoldItemFeeDetail[]
  /**
   * Custo unitário cadastrado (linha ou produto); null = não definido (UI ainda mostra total 0).
   */
  effectiveUnitCostCents: number | null
  costTotalCents: number
  /** Receita − frete − tarifas. */
  grossProfitCents: number
  taxCents: number
  contributionMarginCents: number
  contributionMarginPercent: number | null
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

export function computeTaxCents (
  revenueCents: number,
  marginTaxPercent: number,
  hasAuthorizedFiscalDoc: boolean,
): number {
  if (!hasAuthorizedFiscalDoc) return 0
  const revenue = Math.max(0, Math.trunc(revenueCents) || 0)
  const percent = Number(marginTaxPercent)
  if (!Number.isFinite(percent) || percent <= 0 || revenue <= 0) return 0
  const capped = Math.min(100, Math.max(0, percent))
  return Math.round((revenue * capped) / 100)
}

export function computeSoldItemMargin (input: SoldItemMarginInput): SoldItemMargin {
  const qty = Math.max(1, toNonNegInt(input.quantity) || 1)
  const revenueCents = Math.max(0, Math.trunc(Number(input.subtotalCents) || 0))
  const shippingCents = Math.max(0, Math.trunc(Number(input.allocatedShippingCents) || 0))
  const feeCents = Math.max(0, Math.trunc(Number(input.allocatedFeeCents) || 0))
  const feeDetails = Array.isArray(input.feeDetails)
    ? input.feeDetails
      .map((d) => ({
        label: String(d.label || '').trim() || 'Tarifa',
        amountCents: Math.max(0, Math.trunc(Number(d.amountCents) || 0)),
      }))
      .filter((d) => d.amountCents > 0)
    : []

  const effectiveUnitCostCents = resolveEffectiveUnitCostCents({
    hasProduct: input.hasProduct,
    lineUnitCostCents: input.lineUnitCostCents,
    productCostCents: input.productCostCents,
  })

  const unitForTotal = effectiveUnitCostCents ?? 0
  const costTotalCents = unitForTotal * qty
  const grossProfitCents = revenueCents - shippingCents - feeCents
  const taxCents = computeTaxCents(
    revenueCents,
    Number(input.marginTaxPercent) || 0,
    Boolean(input.hasAuthorizedFiscalDoc),
  )
  const contributionMarginCents = grossProfitCents - costTotalCents - taxCents
  const contributionMarginPercent =
    revenueCents > 0 ? (contributionMarginCents / revenueCents) * 100 : null

  return {
    revenueCents,
    shippingCents,
    feeCents,
    feeDetails,
    effectiveUnitCostCents,
    costTotalCents,
    grossProfitCents,
    taxCents,
    contributionMarginCents,
    contributionMarginPercent,
    canEditCost: input.hasProduct,
  }
}

/**
 * Aloca um valor total do pedido entre itens na proporção do subtotal.
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

/** Aloca frete do pedido (mesmo critério das tarifas). */
export function allocateOrderShippingToItems (
  orderShippingCents: number,
  itemSubtotalsCents: number[],
): number[] {
  return allocateOrderFeeToItems(orderShippingCents, itemSubtotalsCents)
}

/**
 * Frete compartilhado (carrinho MELI / mesmo envio): o valor costuma vir
 * repetido em cada pedido do pack. Deduplica por shipment_id (ou pelo máximo
 * quando não há id) para não somar o mesmo frete várias vezes.
 */
export function dedupeSharedShippingCents (entries: Array<{
  shipmentId?: string | null
  amountCents: number
}>): number {
  const normalized = entries.map((entry) => ({
    shipmentId: String(entry.shipmentId || '').trim(),
    amountCents: Math.max(0, Math.trunc(Number(entry.amountCents) || 0)),
  }))
  const withShipment = normalized.filter((entry) => entry.shipmentId)
  if (withShipment.length > 0) {
    const byShipment = new Map<string, number>()
    for (const entry of withShipment) {
      byShipment.set(
        entry.shipmentId,
        Math.max(byShipment.get(entry.shipmentId) || 0, entry.amountCents),
      )
    }
    let total = 0
    for (const amount of byShipment.values()) total += amount
    return total
  }
  return normalized.reduce((max, entry) => Math.max(max, entry.amountCents), 0)
}

export type PackShippingShare = {
  shippingGrossCents: number
  shippingRefundCents: number
}

/**
 * Rateia frete/reembolso do pool (pack ou pedido) entre linhas, na proporção
 * do subtotal. Chave do pool: pack_id quando existir, senão order_id.
 */
export function allocateSharedShippingToRows <T extends {
  id: string
  subtotalCents: number
  order: { id: string, mlPackId?: string | null }
}> (
  rows: T[],
  shippingByOrderId: Map<string, {
    shipmentId?: string | null
    shippingGrossCents: number
    shippingRefundCents: number
  }>,
): Map<string, PackShippingShare> {
  const out = new Map<string, PackShippingShare>()
  if (rows.length === 0) return out

  const pools = new Map<string, T[]>()
  for (const row of rows) {
    const packId = String(row.order.mlPackId || '').trim()
    const key = packId ? `pack:${packId}` : `order:${row.order.id}`
    const list = pools.get(key)
    if (list) list.push(row)
    else pools.set(key, [row])
  }

  for (const poolRows of pools.values()) {
    const orderIds = [...new Set(poolRows.map((row) => row.order.id).filter(Boolean))]
    const entries = orderIds.map((orderId) => {
      const live = shippingByOrderId.get(orderId)
      return {
        shipmentId: live?.shipmentId ?? null,
        gross: Math.max(0, Math.trunc(Number(live?.shippingGrossCents) || 0)),
        refund: Math.max(0, Math.trunc(Number(live?.shippingRefundCents) || 0)),
      }
    })

    const packGross = dedupeSharedShippingCents(
      entries.map((entry) => ({
        shipmentId: entry.shipmentId,
        amountCents: entry.gross,
      })),
    )
    const packRefund = dedupeSharedShippingCents(
      entries.map((entry) => ({
        shipmentId: entry.shipmentId,
        amountCents: entry.refund,
      })),
    )

    const subtotals = poolRows.map((row) => row.subtotalCents)
    const grossShares = allocateOrderShippingToItems(packGross, subtotals)
    const refundShares = allocateOrderShippingToItems(packRefund, subtotals)

    poolRows.forEach((row, index) => {
      out.set(row.id, {
        shippingGrossCents: grossShares[index] || 0,
        shippingRefundCents: refundShares[index] || 0,
      })
    })
  }

  return out
}
