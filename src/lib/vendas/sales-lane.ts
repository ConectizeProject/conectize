export const SALES_LANES = [
  'all',
  'preparing',
  'shipped',
  'pending_shipment',
  'flex',
  'canceled',
] as const

export type SalesLane = (typeof SALES_LANES)[number]

export const SALES_LANE_OPTIONS: Array<{ id: SalesLane, label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'preparing', label: 'Em preparação' },
  { id: 'shipped', label: 'Despachadas' },
  { id: 'pending_shipment', label: 'Envios pendentes' },
  { id: 'flex', label: 'Flex' },
  { id: 'canceled', label: 'Canceladas' },
]

const SHIPPED_STATUSES = new Set(['shipped', 'delivered', 'not_delivered'])

const LABEL_ISSUED_SUBSTATUSES = new Set([
  'printed',
  'ready_for_pickup',
  'in_hub',
  'in_packing_list',
  'dropped_off',
  'soon_deliver',
  'waiting_for_withdrawal',
  'authorized_by_carrier',
  'in_pickup_list',
])

export type MeliFulfillmentStage = 'preparing' | 'pending_shipment' | 'shipped'

export function parseSalesLane (value: string | null | undefined): SalesLane | null {
  const lane = String(value || '').trim()
  return (SALES_LANES as readonly string[]).includes(lane) ? lane as SalesLane : null
}

export function meliFulfillmentStage (input: {
  shipmentStatus: string | null
  shipmentSubstatus: string | null
}): MeliFulfillmentStage | null {
  const status = String(input.shipmentStatus || '').trim().toLowerCase()
  const substatus = String(input.shipmentSubstatus || '').trim().toLowerCase()
  if (!status) return 'preparing'
  if (status === 'cancelled' || status === 'canceled') return null
  if (SHIPPED_STATUSES.has(status)) return 'shipped'
  if (status === 'ready_to_ship' && LABEL_ISSUED_SUBSTATUSES.has(substatus)) {
    return 'pending_shipment'
  }
  return 'preparing'
}

function collectTags (value: unknown, into: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectTags(item, into)
    return
  }
  if (typeof value !== 'string' && typeof value !== 'number') return
  const text = String(value).trim().toLowerCase()
  if (text) into.push(text)
}

function recordLogisticType (value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const direct = String(record.logistic_type || '').trim()
  if (direct) return direct
  const logistic = record.logistic
  if (!logistic || typeof logistic !== 'object' || Array.isArray(logistic)) return null
  const nested = String((logistic as Record<string, unknown>).type || '').trim()
  return nested || null
}

export function meliLogisticType (input: {
  logisticType: string | null
  tags?: unknown
}): string | null {
  const type = String(input.logisticType || '').trim().toLowerCase()
  if (type) return type
  const tags: string[] = []
  collectTags(input.tags, tags)
  if (tags.includes('self_service_in') || tags.includes('self_service')) {
    return 'self_service'
  }
  return null
}

export function meliLogisticTypeFromShipment (input: {
  shipment?: unknown
  shipping?: unknown
  tags?: unknown
}): string | null {
  return meliLogisticType({
    logisticType: recordLogisticType(input.shipment) ?? recordLogisticType(input.shipping),
    tags: input.tags,
  })
}

export function parseMarketplaceOrderNumber (value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '').slice(0, 20)
}

/** Substatus em que a etiqueta já pode ser impressa (ou já foi). */
export const MELI_LABEL_PRINTABLE_SUBSTATUSES = [
  'ready_to_print',
  'printed',
  'ready_for_pickup',
] as const

export function isMeliLabelPrintableSubstatus (substatus: string | null | undefined): boolean {
  const value = String(substatus || '').trim().toLowerCase()
  return (MELI_LABEL_PRINTABLE_SUBSTATUSES as readonly string[]).includes(value)
}

/**
 * Etapas persistidas que entram em cada menu.
 * - Em preparação: etapa preparing e etiqueta já imprimível
 * - Envios pendentes: não enviadas, exceto FULL (`preparing` + `pending_shipment`)
 * - Despachadas: já enviadas (`shipped`)
 */
export function fulfillmentStagesForLane (lane: SalesLane): string[] | null {
  if (lane === 'preparing') return ['preparing']
  if (lane === 'pending_shipment') return ['preparing', 'pending_shipment']
  if (lane === 'shipped') return ['shipped']
  return null
}

export function isMeliFullLogistic (logisticType: string | null | undefined): boolean {
  return String(logisticType || '').trim().toLowerCase() === 'fulfillment'
}

/** Menus em que FULL não entra (logística do ML). */
export function laneExcludesMeliFull (lane: SalesLane): boolean {
  return lane === 'preparing' || lane === 'pending_shipment'
}

export function orderMatchesSalesLane (order: {
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_substatus?: string | null
}, lane: SalesLane): boolean {
  if (lane === 'flex') return order.ml_logistic_type === 'self_service'
  // FULL: logística do ML, fora de preparação e envios pendentes.
  if (laneExcludesMeliFull(lane) && isMeliFullLogistic(order.ml_logistic_type)) return false
  const stages = fulfillmentStagesForLane(lane)
  if (!stages) return true
  if (!stages.includes(String(order.ml_fulfillment_stage || ''))) return false
  // Em preparação: só quem já pode imprimir a etiqueta.
  if (lane === 'preparing') {
    return isMeliLabelPrintableSubstatus(order.ml_shipment_substatus)
  }
  return true
}

export function fulfillmentStageLabel (stage: string | null | undefined): string | null {
  if (stage === 'preparing') return 'Em preparação'
  if (stage === 'pending_shipment') return 'Envio pendente'
  if (stage === 'shipped') return 'Despachada'
  return null
}
