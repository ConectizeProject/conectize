export type MeliSaleItemRef = {
  itemId: string
  sku: string | null
  title: string | null
  url: string | null
}

export type MeliSaleDisplay = {
  buyerName: string | null
  buyerNickname: string | null
  shippingGrossCents: number | null
  shippingRefundCents: number | null
  saleFeeCents: number | null
  postingDeadline: string | null
  deliveryEstimate: string | null
  shippingMethodName: string | null
  labelStatus: string | null
  /** ISO da data em que a etiqueta fica disponível (buffering.date). */
  labelAvailableAt: string | null
  /** True quando a etiqueta já pode ser impressa/baixada. */
  labelPrintable: boolean
  /** Status da mediação/reclamação MELI (opened | closed). */
  claimStatus: 'opened' | 'closed' | null
  items: MeliSaleItemRef[]
}

export function meliItemPublicUrl (itemId: string, permalink?: string | null): string | null {
  const link = trimText(permalink)
  if (link && /^https:\/\//i.test(link)) return link
  const id = itemId.trim().toUpperCase()
  if (!/^MLB\d+$/.test(id)) return null
  return `https://produto.mercadolivre.com.br/${id.replace(/^(MLB)(\d+)$/, '$1-$2')}`
}

export function matchMeliSaleItem (
  items: MeliSaleItemRef[] | null | undefined,
  input: { sku?: string | null, title?: string | null },
): MeliSaleItemRef | null {
  const list = items ?? []
  if (list.length === 0) return null
  const sku = String(input.sku || '').trim().toLowerCase()
  if (sku) {
    const found = list.find((item) => String(item.sku || '').trim().toLowerCase() === sku)
    if (found) return found
  }
  if (list.length === 1) return list[0]
  const title = String(input.title || '').trim().toLowerCase()
  if (!title) return null
  return list.find((item) => String(item.title || '').trim().toLowerCase() === title) ?? null
}

function saleItemsFromOrder (order: Record<string, unknown> | null): MeliSaleItemRef[] {
  const entries = Array.isArray(order?.order_items) ? order.order_items : []
  const items: MeliSaleItemRef[] = []
  for (const entry of entries) {
    const row = asRecord(entry)
    const item = asRecord(row?.item)
    const itemId = trimText(item?.id)?.toUpperCase() || null
    if (!itemId) continue
    items.push({
      itemId,
      sku: trimText(item?.seller_sku) || trimText(item?.seller_custom_field),
      title: trimText(item?.title),
      url: meliItemPublicUrl(itemId, trimText(item?.permalink)),
    })
  }
  return items
}

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimText (value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function reaisToCents (value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

function reaisToCentsAllowZero (value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

function sumSenderFieldCents (
  costs: Record<string, unknown> | null | undefined,
  field: 'cost' | 'compensation',
): number | null {
  const senders = Array.isArray(costs?.senders) ? costs.senders : null
  if (!senders || senders.length === 0) return null
  let total = 0
  let found = false
  for (const entry of senders) {
    const row = asRecord(entry)
    const cents = reaisToCentsAllowZero(row?.[field])
    if (cents == null) continue
    found = true
    total += cents
  }
  return found ? total : null
}

/**
 * Frete do vendedor: `senders[].cost` (custo final cobrado).
 * Reembolso/subsídio: compensação do sender; se o vendedor paga 0 e há
 * `gross_amount`, mostra frete + reembolso integrais (frete grátis).
 * Fallback legado: `gross_amount` + `receiver.save` (campo descontinuado).
 */
export function shippingCentsFromMeliCosts (
  costs: Record<string, unknown> | null | undefined,
): { shippingGrossCents: number | null, shippingRefundCents: number | null } {
  const grossCents = reaisToCents(costs?.gross_amount)
  const senderCostCents = sumSenderFieldCents(costs, 'cost')
  const compensationCents = sumSenderFieldCents(costs, 'compensation') ?? 0

  if (senderCostCents != null) {
    if (senderCostCents > 0) {
      return {
        shippingGrossCents: senderCostCents,
        shippingRefundCents: compensationCents > 0 ? compensationCents : null,
      }
    }
    if (grossCents != null) {
      return {
        shippingGrossCents: grossCents,
        shippingRefundCents: grossCents,
      }
    }
    return { shippingGrossCents: null, shippingRefundCents: null }
  }

  const receiver = asRecord(costs?.receiver)
  return {
    shippingGrossCents: grossCents,
    shippingRefundCents: reaisToCents(receiver?.save),
  }
}

export function isMeliLabelPrintable (
  _shipmentStatus: string | null | undefined,
  shipmentSubstatus: string | null | undefined,
): boolean {
  const substatus = String(shipmentSubstatus || '').trim().toLowerCase()
  return (
    substatus === 'ready_to_print'
    || substatus === 'printed'
    || substatus === 'ready_for_pickup'
  )
}

export function meliLabelAvailableAt (shipment: Record<string, unknown> | null): string | null {
  const leadTime = asRecord(shipment?.lead_time)
  const bufferingDate = trimText(asRecord(leadTime?.buffering)?.date)
  const edt = asRecord(leadTime?.estimated_delivery_time)
  const shippingHours = Math.trunc(Number(edt?.shipping) || 0)
  const createdAt = trimText(shipment?.date_created)

  // No painel do MELI, "disponível a partir de" costuma ser o início da janela
  // (criação do envio + horas de shipping). buffering.date às vezes cai no prazo final.
  if (createdAt && shippingHours > 0) {
    const createdMs = Date.parse(createdAt)
    if (Number.isFinite(createdMs)) {
      const fromShippingMs = createdMs + shippingHours * 3_600_000
      const bufferingMs = bufferingDate ? Date.parse(bufferingDate) : NaN
      if (
        !Number.isFinite(bufferingMs)
        || fromShippingMs < bufferingMs
      ) {
        return new Date(fromShippingMs).toISOString()
      }
    }
  }

  return bufferingDate
}

export function meliLabelStatus (
  shipmentStatus: string | null | undefined,
  shipmentSubstatus: string | null | undefined,
): string | null {
  const status = String(shipmentStatus || '').trim().toLowerCase()
  const substatus = String(shipmentSubstatus || '').trim().toLowerCase()
  if (substatus === 'ready_to_print') return 'Etiqueta aguardando impressão'
  if (substatus === 'printed' || substatus === 'ready_for_pickup') return 'Etiqueta impressa'
  if (substatus === 'in_hub' || substatus === 'in_packing_list') return 'Etiqueta em trânsito para o envio'
  if (substatus === 'buffered') return 'Etiqueta agendada'
  if (status === 'shipped') return 'Enviado'
  if (status === 'delivered') return 'Entregue'
  if (status === 'ready_to_ship' || status === 'pending' || status === 'handling') return 'Em preparação'
  return null
}

export function meliSaleDisplayFromPayloads (input: {
  order: Record<string, unknown> | null
  shipment: Record<string, unknown> | null
  costs: Record<string, unknown> | null
  sla: Record<string, unknown> | null
}): MeliSaleDisplay {
  const buyer = asRecord(input.order?.buyer)
  const first = trimText(buyer?.first_name)
  const last = trimText(buyer?.last_name)
  const buyerName = [first, last].filter(Boolean).join(' ').trim() || null
  const buyerNickname = trimText(buyer?.nickname)

  const items = Array.isArray(input.order?.order_items) ? input.order?.order_items : []
  let saleFeeCents = 0
  for (const item of items) {
    const row = asRecord(item)
    const fee = reaisToCents(row?.sale_fee)
    if (!fee) continue
    // sale_fee na API do MELI é por unidade
    const quantity = Math.max(1, Math.trunc(Number(row?.quantity) || 1))
    saleFeeCents += fee * quantity
  }

  const { shippingGrossCents, shippingRefundCents } = shippingCentsFromMeliCosts(input.costs)

  const leadTime = asRecord(input.shipment?.lead_time)
  const estimated = asRecord(leadTime?.estimated_delivery_time)
  const method = asRecord(leadTime?.shipping_method)
  const shipmentStatus = trimText(input.shipment?.status)
  const shipmentSubstatus = trimText(input.shipment?.substatus)

  return {
    buyerName,
    buyerNickname,
    shippingGrossCents,
    shippingRefundCents,
    saleFeeCents: saleFeeCents > 0 ? saleFeeCents : null,
    postingDeadline: trimText(input.sla?.expected_date),
    deliveryEstimate: trimText(estimated?.date),
    shippingMethodName: trimText(method?.name),
    labelStatus: meliLabelStatus(shipmentStatus, shipmentSubstatus),
    labelAvailableAt: meliLabelAvailableAt(input.shipment),
    labelPrintable: isMeliLabelPrintable(shipmentStatus, shipmentSubstatus),
    claimStatus: null,
    items: saleItemsFromOrder(input.order),
  }
}

export function meliClaimStatusLabel (status: string | null | undefined): string | null {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'closed') return 'Mediação Encerrada'
  if (value === 'opened') return 'Mediação Aberta'
  return null
}

export type SaleProfitBreakdown = {
  saleCents: number
  freightCents: number
  refundCents: number
  feeCents: number
  grossCents: number
  productCostCents: number
  taxCents: number
  netCents: number
}

function nonNegativeCents (value: number) {
  const amount = Math.trunc(Number(value) || 0)
  return amount > 0 ? amount : 0
}

export function saleProfitBreakdown (input: {
  saleCents: number
  freightCents: number
  refundCents: number
  feeCents: number
  productCostCents: number
  taxCents: number
}): SaleProfitBreakdown {
  const saleCents = nonNegativeCents(input.saleCents)
  const freightCents = nonNegativeCents(input.freightCents)
  const refundCents = nonNegativeCents(input.refundCents)
  const feeCents = nonNegativeCents(input.feeCents)
  const productCostCents = nonNegativeCents(input.productCostCents)
  const taxCents = nonNegativeCents(input.taxCents)
  const grossCents = saleCents - freightCents + refundCents - feeCents
  const netCents = grossCents - productCostCents - taxCents
  return {
    saleCents,
    freightCents,
    refundCents,
    feeCents,
    grossCents,
    productCostCents,
    taxCents,
    netCents,
  }
}

export function taxCentsFromMargin (totalCents: number, marginTaxPercent: number): number {
  const total = Math.max(0, Math.trunc(Number(totalCents) || 0))
  const percent = Number(marginTaxPercent)
  if (!Number.isFinite(percent) || percent <= 0 || total <= 0) return 0
  const capped = Math.min(100, percent)
  return Math.round((total * capped) / 100)
}

export type StockMovementSign = {
  productId: string
  salesOrderId: string | null
  type: string
  quantity: number
  createdAt: string
}

export function saleExitAt (
  movements: StockMovementSign[],
  salesOrderId: string,
  productId: string,
): string | null {
  let latest: string | null = null
  for (const movement of movements) {
    if (movement.salesOrderId !== salesOrderId || movement.productId !== productId) continue
    if (movement.type !== 'exit') continue
    if (!latest || movement.createdAt > latest) latest = movement.createdAt
  }
  return latest
}

export function stockAfterSale (input: {
  currentStock: number
  saleAt: string | null
  movements: StockMovementSign[]
  productId: string
}): number | null {
  if (!input.saleAt) return null
  const saleMs = Date.parse(input.saleAt)
  if (!Number.isFinite(saleMs)) return null
  let deltaAfter = 0
  for (const movement of input.movements) {
    if (movement.productId !== input.productId) continue
    const at = Date.parse(movement.createdAt)
    if (!Number.isFinite(at) || at <= saleMs) continue
    const quantity = Math.max(0, Math.trunc(Number(movement.quantity) || 0))
    if (quantity <= 0) continue
    if (movement.type === 'exit') deltaAfter -= quantity
    else if (movement.type === 'entry') deltaAfter += quantity
  }
  return input.currentStock - deltaAfter
}
