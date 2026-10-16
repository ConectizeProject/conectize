import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getMeliConnectionByOrganizationId,
  getMeliOrder,
  getMeliShipment,
  getMeliShipmentCosts,
  getMeliShipmentSla,
  pickMeliClaimForDisplay,
  searchMeliClaimsByOrderId,
  type HubConnection,
} from '@/lib/integrations/mercado-livre/api'
import {
  meliLabelAvailableAt,
  meliSaleDisplayFromPayloads,
  type MeliSaleDisplay,
} from '@/lib/vendas/meli-sale-display'
import {
  meliFulfillmentStage,
  meliLogisticTypeFromShipment,
  type MeliFulfillmentStage,
} from '@/lib/vendas/sales-lane'

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimText (value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

export type MeliFulfillmentSnapshot = {
  shipmentId: string | null
  shipmentStatus: string | null
  shipmentSubstatus: string | null
  logisticType: string | null
  stage: MeliFulfillmentStage | null
  sale: MeliSaleDisplay | null
}

export function snapshotFromMeliPayloads (
  order: Record<string, unknown> | null,
  shipment: Record<string, unknown> | null,
): MeliFulfillmentSnapshot {
  const shipping = asRecord(order?.shipping)
  const shipmentId = trimText(shipment?.id) ?? trimText(shipping?.id)
  const shipmentStatus = trimText(shipment?.status) ?? trimText(shipping?.status)
  const shipmentSubstatus = trimText(shipment?.substatus) ?? trimText(shipping?.substatus)
  const logisticType = meliLogisticTypeFromShipment({
    shipment,
    shipping,
    tags: [order?.tags, shipment?.tags],
  })
  return {
    shipmentId,
    shipmentStatus,
    shipmentSubstatus,
    logisticType,
    stage: meliFulfillmentStage({ shipmentStatus, shipmentSubstatus }),
    sale: null,
  }
}

function toIsoOrNull (value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw || !Number.isFinite(Date.parse(raw))) return null
  return new Date(raw).toISOString()
}

export async function persistMeliFulfillment (params: {
  supabase: SupabaseClient
  organizationId: string
  salesOrderId: string
  order: Record<string, unknown> | null
  shipment?: Record<string, unknown> | null
  postingDeadline?: string | null
  labelAvailableAt?: string | null
  shippingMethod?: string | null
  claimStatus?: string | null
}): Promise<'ok' | 'error' | 'missing_column'> {
  const snapshot = snapshotFromMeliPayloads(params.order, params.shipment ?? null)
  const purchasedRaw =
    trimText(params.order?.date_created) || trimText(params.order?.date_closed)
  const purchasedAtIso =
    purchasedRaw && Number.isFinite(Date.parse(purchasedRaw))
      ? new Date(purchasedRaw).toISOString()
      : null
  const labelAvailableAt = toIsoOrNull(
    params.labelAvailableAt ?? meliLabelAvailableAt(params.shipment ?? null),
  )
  const leadTime = asRecord(params.shipment?.lead_time)
  const handlingLimit = trimText(asRecord(leadTime?.estimated_handling_limit)?.date)
  const postingDeadline = toIsoOrNull(
    params.postingDeadline ?? handlingLimit ?? labelAvailableAt,
  )
  const shippingMethod = trimText(params.shippingMethod)
    ?? trimText(asRecord(leadTime?.shipping_method)?.name)
  const claimStatus = trimText(params.claimStatus)?.toLowerCase()
  const { error } = await params.supabase
    .from('sales_orders')
    .update({
      ml_shipment_id: snapshot.shipmentId,
      ml_shipment_status: snapshot.shipmentStatus,
      ml_shipment_substatus: snapshot.shipmentSubstatus,
      ml_logistic_type: snapshot.logisticType,
      ml_fulfillment_stage: snapshot.stage,
      updated_at: new Date().toISOString(),
      ...(purchasedAtIso ? { created_at: purchasedAtIso } : {}),
      ...(labelAvailableAt ? { ml_label_available_at: labelAvailableAt } : {}),
      ...(postingDeadline ? { ml_posting_deadline: postingDeadline } : {}),
      ...(shippingMethod ? { ml_shipping_method: shippingMethod } : {}),
      ...(claimStatus === 'opened' || claimStatus === 'closed'
        ? { ml_claim_status: claimStatus }
        : {}),
    })
    .eq('organization_id', params.organizationId)
    .eq('id', params.salesOrderId)

  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return 'missing_column'
    console.error('[meli fulfillment]', error.message)
    return 'error'
  }
  return 'ok'
}

const LIVE_CACHE_MS = 5 * 60 * 1000
const liveCache = new Map<string, { at: number, snapshot: MeliFulfillmentSnapshot }>()
let persistUnavailable = false

type LiveFulfillmentOrder = {
  id: string
  ml_order_id?: string | null
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_id?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
  ml_buyer_name?: string | null
  ml_buyer_nickname?: string | null
  ml_shipping_gross_cents?: number | null
  ml_shipping_refund_cents?: number | null
  ml_sale_fee_cents?: number | null
  ml_posting_deadline?: string | null
  ml_delivery_estimate?: string | null
  ml_shipping_method?: string | null
  ml_label_status?: string | null
  ml_label_available_at?: string | null
  ml_label_printable?: boolean | null
  ml_claim_status?: string | null
  ml_sale_items?: MeliSaleDisplay['items'] | null
  status?: string | null
}

async function loadLiveSnapshot (
  connection: HubConnection,
  mlOrderId: string,
  supabase: SupabaseClient,
  options?: { preferFreshClaims?: boolean },
): Promise<{ snapshot: MeliFulfillmentSnapshot, order: Record<string, unknown> } | null> {
  const cached = liveCache.get(mlOrderId)
  const cacheHasClaim = Boolean(cached?.snapshot.sale?.claimStatus)
  const skipCache = Boolean(options?.preferFreshClaims && !cacheHasClaim)
  if (
    !skipCache
    && cached
    && Date.now() - cached.at < LIVE_CACHE_MS
    && cached.snapshot.sale
    && Array.isArray(cached.snapshot.sale.items)
  ) {
    return { snapshot: cached.snapshot, order: {} }
  }
  try {
    const order = await getMeliOrder(connection, mlOrderId, supabase)
    const shipping = asRecord(order.shipping)
    const shipmentId = trimText(shipping?.id)
    let shipment: Record<string, unknown> | null = null
    let costs: Record<string, unknown> | null = null
    let sla: Record<string, unknown> | null = null
    const packId = trimText(order.pack_id)
    const [shipmentBundle, claims] = await Promise.all([
      shipmentId
        ? Promise.all([
          getMeliShipment(connection, shipmentId, supabase).catch(() => null),
          getMeliShipmentCosts(connection, shipmentId, supabase).catch(() => null),
          getMeliShipmentSla(connection, shipmentId, supabase).catch(() => null),
        ])
        : Promise.resolve([null, null, null] as const),
      searchMeliClaimsByOrderId(connection, mlOrderId, supabase, { packId }).catch(() => []),
    ])
    if (shipmentId) {
      shipment = shipmentBundle[0]
      costs = shipmentBundle[1]
      sla = shipmentBundle[2]
    }
    const snapshot = snapshotFromMeliPayloads(order, shipment)
    snapshot.sale = meliSaleDisplayFromPayloads({ order, shipment, costs, sla })
    const claim = pickMeliClaimForDisplay(claims)
    if (snapshot.sale) {
      snapshot.sale.claimStatus = claim?.status ?? null
    }
    liveCache.set(mlOrderId, { at: Date.now(), snapshot })
    return { snapshot, order }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[meli fulfillment live]', message)
    return null
  }
}

export type LiveMeliFulfillmentFields = {
  ml_shipment_id?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_buyer_name?: string | null
  ml_buyer_nickname?: string | null
  ml_shipping_gross_cents?: number | null
  ml_shipping_refund_cents?: number | null
  ml_sale_fee_cents?: number | null
  ml_posting_deadline?: string | null
  ml_delivery_estimate?: string | null
  ml_shipping_method?: string | null
  ml_label_status?: string | null
  ml_label_available_at?: string | null
  ml_label_printable?: boolean | null
  ml_claim_status?: string | null
  ml_sale_items?: MeliSaleDisplay['items'] | null
}

export async function withLiveMeliFulfillment<T extends LiveFulfillmentOrder> (params: {
  supabase: SupabaseClient
  organizationId: string
  orders: T[]
}): Promise<Array<T & LiveMeliFulfillmentFields>> {
  const pending = params.orders.filter((order) => {
    const mlOrderId = String(order.ml_order_id || '').trim()
    if (!mlOrderId) return false
    const isCanceled = String(order.status || '').trim().toLowerCase() === 'canceled'
      || String(order.status || '').trim().toLowerCase() === 'cancelled'
    return (
      !order.ml_fulfillment_stage
      || !order.ml_label_status
      || !order.ml_shipment_id
      || (isCanceled && !order.ml_claim_status)
    )
  })
  if (pending.length === 0) return params.orders as Array<T & LiveMeliFulfillmentFields>

  const connection = await getMeliConnectionByOrganizationId(
    params.supabase,
    params.organizationId,
  )
  if (!connection) return params.orders as Array<T & LiveMeliFulfillmentFields>

  const snapshots = new Map<string, MeliFulfillmentSnapshot>()
  let cursor = 0
  async function worker () {
    for (;;) {
      const index = cursor
      cursor += 1
      const order = pending[index]
      if (!order) return
      const mlOrderId = String(order.ml_order_id || '').trim()
      const isCanceled = String(order.status || '').trim().toLowerCase() === 'canceled'
        || String(order.status || '').trim().toLowerCase() === 'cancelled'
      const live = await loadLiveSnapshot(connection, mlOrderId, params.supabase, {
        preferFreshClaims: isCanceled && !order.ml_claim_status,
      })
      if (!live) continue
      const { snapshot, order: meliOrder } = live
      snapshots.set(order.id, snapshot)
      if (persistUnavailable) continue
      const saved = await persistMeliFulfillment({
        supabase: params.supabase,
        organizationId: params.organizationId,
        salesOrderId: order.id,
        order: meliOrder,
        shipment: {
          id: snapshot.shipmentId,
          status: snapshot.shipmentStatus,
          substatus: snapshot.shipmentSubstatus,
          logistic_type: snapshot.logisticType,
        },
        postingDeadline: snapshot.sale?.postingDeadline ?? null,
        labelAvailableAt: snapshot.sale?.labelAvailableAt ?? null,
        shippingMethod: snapshot.sale?.shippingMethodName ?? null,
        claimStatus: snapshot.sale?.claimStatus ?? null,
      })
      if (saved === 'missing_column') persistUnavailable = true
    }
  }

  const workers = Math.min(4, pending.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))

  if (snapshots.size === 0) return params.orders as Array<T & LiveMeliFulfillmentFields>
  return params.orders.map((order) => {
    const snapshot = snapshots.get(order.id)
    if (!snapshot) return order as T & LiveMeliFulfillmentFields
    const sale = snapshot.sale
    return {
      ...order,
      ml_shipment_id: snapshot.shipmentId,
      ml_shipment_status: snapshot.shipmentStatus,
      ml_shipment_substatus: snapshot.shipmentSubstatus,
      ml_logistic_type: snapshot.logisticType,
      ml_fulfillment_stage: snapshot.stage,
      ml_buyer_name: sale?.buyerName ?? null,
      ml_buyer_nickname: sale?.buyerNickname ?? null,
      ml_shipping_gross_cents: sale?.shippingGrossCents ?? null,
      ml_shipping_refund_cents: sale?.shippingRefundCents ?? null,
      ml_sale_fee_cents: sale?.saleFeeCents ?? null,
      ml_posting_deadline: sale?.postingDeadline ?? null,
      ml_delivery_estimate: sale?.deliveryEstimate ?? null,
      ml_shipping_method: sale?.shippingMethodName ?? null,
      ml_label_status: sale?.labelStatus ?? null,
      ml_label_available_at: sale?.labelAvailableAt ?? null,
      ml_label_printable: sale?.labelPrintable ?? null,
      // Não apaga claim já persistido se o live voltar sem reclamação.
      ml_claim_status: sale?.claimStatus ?? order.ml_claim_status ?? null,
      ml_sale_items: sale?.items ?? null,
    }
  })
}
