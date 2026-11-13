import { brazilTodayDateString } from '@/lib/dashboard/brazil-day'

export const SALES_LANES = [
  'all',
  'preparing',
  'shipped',
  'pending_shipment',
  'flex',
  'canceled',
  /** Canceladas MELI do dia (não enviar). Não inclui FULL. */
  'dont_ship',
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

/** Etapas ainda não despachadas (para enviar hoje ou nos próximos dias). */
export const MELI_OPEN_FULFILLMENT_STAGES = ['preparing', 'pending_shipment'] as const

function brazilDateKey (iso: string | null | undefined) {
  const raw = String(iso || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return brazilTodayDateString(parsed)
}

/** Dia em que a etiqueta libera para o vendedor (fuso BR). */
export function meliShipReadyDateKey (row: {
  ml_label_available_at?: string | null
  /** Fallback: prazo de postagem (Flex costuma ter só isso). */
  ml_posting_deadline?: string | null
}) {
  return brazilDateKey(row.ml_label_available_at)
    ?? brazilDateKey(row.ml_posting_deadline)
}

export function isMeliOpenFulfillmentStage (stage: string | null | undefined) {
  const value = String(stage || '').trim().toLowerCase()
  return value === 'preparing' || value === 'pending_shipment'
}

/**
 * Ainda não liberou para envio neste dia: buffered ou data futura.
 * Sem datas → trata como hoje (evita Flex pronto cair em "Próximos dias").
 */
export function isMeliShippingUpcoming (
  row: {
    ml_label_available_at?: string | null
    ml_posting_deadline?: string | null
    ml_shipment_substatus?: string | null
  },
  today = brazilTodayDateString(),
) {
  const substatus = String(row.ml_shipment_substatus || '').trim().toLowerCase()
  if (substatus === 'buffered') return true
  const readyDay = meliShipReadyDateKey(row)
  if (!readyDay) return false
  return readyDay > today
}

/** Dia de calendário do envio (etiqueta/prazo) é exatamente `today`. */
export function isMeliShippingCalendarDay (
  row: {
    ml_label_available_at?: string | null
    ml_posting_deadline?: string | null
  },
  today = brazilTodayDateString(),
) {
  const readyDay = meliShipReadyDateKey(row)
  return Boolean(readyDay) && readyDay === today
}

export function isMeliShippingTodayReady (
  row: {
    ml_fulfillment_stage?: string | null
    ml_label_available_at?: string | null
    ml_posting_deadline?: string | null
    ml_shipment_substatus?: string | null
  },
  today = brazilTodayDateString(),
) {
  return isMeliOpenFulfillmentStage(row.ml_fulfillment_stage)
    && !isMeliShippingUpcoming(row, today)
}

/** Nomes de método do ML que na prática são Flex (ex.: Prioritario). */
export function isMeliFlexShippingMethodName (value: string | null | undefined) {
  const name = String(value || '').trim().toLowerCase()
  if (!name) return false
  if (name === 'flex' || name.includes('flex')) return true
  const folded = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return folded === 'prioritario' || folded.includes('prioritario')
}

/** Flex: self_service ou método Prioritario/Flex. Nunca FULL. */
export function isMeliFlexShippingOrder (order: {
  ml_logistic_type?: string | null
  ml_shipping_method?: string | null
}) {
  const logistic = String(order.ml_logistic_type || '').trim().toLowerCase()
  if (logistic === 'fulfillment') return false
  return logistic === 'self_service'
    || isMeliFlexShippingMethodName(order.ml_shipping_method)
}

const SHIPPED_STATUSES = new Set(['shipped', 'delivered', 'not_delivered'])

/**
 * Vendedor já postou / entregou à logística.
 * No ML isso frequentemente fica em ready_to_ship (ex.: dropped_off, picked_up),
 * mas para o painel "Para enviar" já não deve aparecer.
 */
const SELLER_POSTED_SUBSTATUSES = new Set([
  'dropped_off',
  'picked_up',
  'authorized_by_carrier',
  'in_hub',
  'in_packing_list',
  'soon_deliver',
  'waiting_for_withdrawal',
])

/** Etiqueta pronta, ainda cabe ação do vendedor (imprimir/postar/aguardar coleta). */
const LABEL_READY_SUBSTATUSES = new Set([
  'printed',
  'ready_for_pickup',
  'ready_for_dropoff',
  'in_pickup_list',
  'ready_for_pkl_creation',
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
  // ready_to_ship + dropped_off/picked_up/... = já postado ("A caminho" no ML).
  if (status === 'ready_to_ship' && SELLER_POSTED_SUBSTATUSES.has(substatus)) {
    return 'shipped'
  }
  if (status === 'ready_to_ship' && LABEL_READY_SUBSTATUSES.has(substatus)) {
    return 'pending_shipment'
  }
  return 'preparing'
}

/** Recalcula a etapa a partir do status/substatus quando existirem (corrige stage stale no banco). */
export function resolveMeliFulfillmentStage (order: {
  ml_fulfillment_stage?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
}): MeliFulfillmentStage | null {
  const hasShipmentSignal = Boolean(
    String(order.ml_shipment_status || '').trim()
    || String(order.ml_shipment_substatus || '').trim(),
  )
  if (hasShipmentSignal) {
    return meliFulfillmentStage({
      shipmentStatus: order.ml_shipment_status ?? null,
      shipmentSubstatus: order.ml_shipment_substatus ?? null,
    })
  }
  const stored = String(order.ml_fulfillment_stage || '').trim()
  if (stored === 'preparing' || stored === 'pending_shipment' || stored === 'shipped') {
    return stored
  }
  return null
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
 * Etapas persistidas que entram em cada menu (pré-filtro SQL).
 * O recorte fino (hoje vs próximos dias / Flex) usa `orderMatchesSalesLane`.
 */
export function fulfillmentStagesForLane (lane: SalesLane): string[] | null {
  if (lane === 'preparing' || lane === 'pending_shipment' || lane === 'flex') {
    return [...MELI_OPEN_FULFILLMENT_STAGES]
  }
  if (lane === 'shipped') return ['shipped']
  return null
}

export function isMeliFullLogistic (logisticType: string | null | undefined): boolean {
  return String(logisticType || '').trim().toLowerCase() === 'fulfillment'
}

export function isMeliFlexLogistic (logisticType: string | null | undefined): boolean {
  return String(logisticType || '').trim().toLowerCase() === 'self_service'
}

/** Menus em que FULL não entra (logística do ML). */
export function laneExcludesMeliFull (lane: SalesLane): boolean {
  return lane === 'preparing' || lane === 'pending_shipment' || lane === 'flex'
}

function isMeliCanceledOrder (order: {
  status?: string | null
  ml_shipment_status?: string | null
}) {
  const status = String(order.status || '').trim().toLowerCase()
  const shipStatus = String(order.ml_shipment_status || '').trim().toLowerCase()
  return status === 'canceled'
    || status === 'cancelled'
    || shipStatus === 'cancelled'
    || shipStatus === 'canceled'
}

/**
 * Cancelada MELI do dia corrente, sem FULL: "Canceladas. Não enviar".
 * Exige data de etiqueta/prazo === hoje (sem data ou outros dias ficam de fora).
 */
export function orderMatchesDontShipCanceled (order: {
  status?: string | null
  ml_order_id?: string | null
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
  ml_label_available_at?: string | null
  ml_posting_deadline?: string | null
}, today = brazilTodayDateString()): boolean {
  if (!String(order.ml_order_id || '').trim()) return false
  if (!isMeliCanceledOrder(order)) return false
  if (isMeliFullLogistic(order.ml_logistic_type)) return false
  const stage = resolveMeliFulfillmentStage(order)
  const shipStatus = String(order.ml_shipment_status || '').trim().toLowerCase()
  if (stage === 'shipped' || shipStatus === 'shipped' || shipStatus === 'delivered') {
    return false
  }
  return isMeliShippingCalendarDay(order, today)
}

/**
 * Alinhado ao painel de envios:
 * - preparing: para enviar hoje (não Full, não Flex)
 * - flex: Flex para enviar hoje
 * - pending_shipment: próximos dias (não Full)
 * - shipped: já despachadas
 * - dont_ship: canceladas MELI do dia (não Full)
 */
export function orderMatchesSalesLane (order: {
  status?: string | null
  ml_order_id?: string | null
  ml_logistic_type?: string | null
  ml_shipping_method?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
  ml_label_available_at?: string | null
  ml_posting_deadline?: string | null
}, lane: SalesLane, today = brazilTodayDateString()): boolean {
  const isFull = isMeliFullLogistic(order.ml_logistic_type)
  const isFlex = isMeliFlexShippingOrder(order)
  const stage = resolveMeliFulfillmentStage(order)
  const isOpen = isMeliOpenFulfillmentStage(stage)
  const isUpcoming = isMeliShippingUpcoming(order, today)
  const isToday = isOpen && !isUpcoming

  if (lane === 'dont_ship') return orderMatchesDontShipCanceled(order, today)
  if (lane === 'flex') return isFlex && isToday
  if (lane === 'preparing') return !isFull && !isFlex && isToday
  if (lane === 'pending_shipment') return !isFull && isOpen && isUpcoming
  if (lane === 'shipped') return stage === 'shipped'
  return true
}

export function fulfillmentStageLabel (stage: string | null | undefined): string | null {
  if (stage === 'preparing') return 'Em preparação'
  if (stage === 'pending_shipment') return 'Envio pendente'
  if (stage === 'shipped') return 'Despachada'
  return null
}
