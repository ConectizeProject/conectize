import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	getMeliOrder,
	getMeliShipment,
	pickMeliClaimForDisplay,
	searchMeliClaimsByOrderId,
	type HubConnection,
} from '@/lib/integrations/mercado-livre/api'
import { persistMeliFulfillment } from '@/lib/integrations/mercado-livre/fulfillment'
import { resolveMeliProductId } from '@/lib/integrations/mercado-livre/product-resolve'
import { extractMeliOrderIdFromResource } from '@/lib/integrations/mercado-livre/webhooks'
import {
	cancelSalesOrder,
	createSalesOrder,
	finalizeSalesOrder,
	replaceSalesOrderPayments,
	reverseSalesOrderStockIfFull,
	type SalesOrderDraftInput,
	type SalesOrderItemInput,
	type SalesOrderPaymentInput,
	updateSalesOrderDraft,
} from '@/lib/sales-orders/service'

type ServiceClient = SupabaseClient

type AuthCtx = {
	organizationId: string
	userId: string
	supabase: SupabaseClient
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return value as Record<string, unknown>
}

function trimText(value: unknown): string | null {
	if (value == null) return null
	const s = String(value).trim()
	return s || null
}

function reaisToCents(value: unknown): number {
	const n = Number(value)
	if (!Number.isFinite(n) || n < 0) return 0
	return Math.round(n * 100)
}

function digitsOnly(value: string): string {
	return value.replace(/\D/g, '')
}

export type MeliLocalOrderStatus = 'paid' | 'canceled' | 'pending'

export function mapMeliOrderStatus(
	order: Record<string, unknown>,
): MeliLocalOrderStatus {
	const status = String(order.status || '')
		.trim()
		.toLowerCase()
	if (status === 'cancelled' || status === 'canceled' || status === 'invalid') {
		return 'canceled'
	}
	if (status === 'paid') return 'paid'
	return 'pending'
}

function mapBuyerDraft(order: Record<string, unknown>): SalesOrderDraftInput {
	const buyer = asRecord(order.buyer) ?? {}
	const billing = asRecord(buyer.billing_info)
	const first = trimText(buyer.first_name)
	const last = trimText(buyer.last_name)
	const nickname = trimText(buyer.nickname)
	const fullName = [first, last].filter(Boolean).join(' ').trim()
	const customerName = fullName || nickname || 'Consumidor Mercado Livre'

	const docType = String(buyer.doc_type ?? billing?.doc_type ?? '')
		.trim()
		.toUpperCase()
	const docNumberRaw =
		trimText(buyer.doc_number) ?? trimText(billing?.doc_number)
	const docNumber = docNumberRaw ? digitsOnly(docNumberRaw) : null

	let customerType: 'pf' | 'pj' | null = null
	if (docType.includes('CNPJ') || (docNumber && docNumber.length === 14))
		customerType = 'pj'
	else if (docType.includes('CPF') || (docNumber && docNumber.length === 11))
		customerType = 'pf'

	const shipping = asRecord(order.shipping)
	const surchargeCents = reaisToCents(shipping?.cost)

	const coupon = asRecord(order.coupon)
	const discountTotalCents = reaisToCents(coupon?.amount)

	const packId = order.pack_id != null ? String(order.pack_id) : null

	return {
		customer_name: customerName,
		customer_type: customerType ?? 'pf',
		customer_document: docNumber,
		surcharge_cents: surchargeCents,
		discount_total_cents: discountTotalCents,
		ml_pack_id: packId,
	}
}

function mapPayments(
	order: Record<string, unknown>,
	fallbackAmountCents: number,
): SalesOrderPaymentInput[] {
	const raw = Array.isArray(order.payments) ? order.payments : []
	const approved = raw
		.map((row) => asRecord(row))
		.filter((row): row is Record<string, unknown> => Boolean(row))
		.filter((row) => String(row.status || '').toLowerCase() === 'approved')

	const payments: SalesOrderPaymentInput[] = approved.map((row) => ({
		payment_method_type: 'outro' as const,
		amount_cents: Math.max(
			1,
			reaisToCents(row.transaction_amount ?? row.total_paid_amount),
		),
		status: 'paid' as const,
		metadata: {
			source: 'mercado_livre',
			meli_payment_id: row.id ?? null,
			payment_type: row.payment_type ?? row.payment_type_id ?? null,
			payment_method_id: row.payment_method_id ?? null,
			status: row.status ?? null,
		},
	}))

	const sum = payments.reduce((acc, p) => acc + p.amount_cents, 0)
	if (payments.length === 0 && fallbackAmountCents > 0) {
		return [
			{
				payment_method_type: 'outro',
				amount_cents: fallbackAmountCents,
				status: 'paid',
				metadata: { source: 'mercado_livre', meli_order_id: order.id ?? null },
			},
		]
	}

	if (sum < fallbackAmountCents && payments.length > 0) {
		const last = payments[payments.length - 1]
		last.amount_cents += fallbackAmountCents - sum
	}

	return payments
}

async function resolveActorUserId(
	supabase: ServiceClient,
	organizationId: string,
	connection: HubConnection,
): Promise<string> {
	if (connection.created_by) return String(connection.created_by)

	const { data: admin } = await supabase
		.from('organization_members')
		.select('user_id, users!inner(role)')
		.eq('organization_id', organizationId)
		.eq('users.role', 'admin')
		.limit(1)
		.maybeSingle()
	if (admin?.user_id) return String(admin.user_id)

	const { data: staff } = await supabase
		.from('organization_members')
		.select('user_id, users!inner(role)')
		.eq('organization_id', organizationId)
		.eq('users.role', 'staff')
		.limit(1)
		.maybeSingle()
	if (staff?.user_id) return String(staff.user_id)

	throw new Error('meli_actor_user_missing')
}

async function findSalesOrderByMlId(
	supabase: ServiceClient,
	organizationId: string,
	mlOrderId: string,
): Promise<{ id: string; status: string } | null> {
	const { data } = await supabase
		.from('sales_orders')
		.select('id, status')
		.eq('organization_id', organizationId)
		.eq('ml_order_id', mlOrderId)
		.maybeSingle()

	if (!data?.id) return null
	return { id: String(data.id), status: String(data.status || '') }
}

async function mapOrderItems(params: {
	supabase: ServiceClient
	organizationId: string
	createdBy: string
	connection: HubConnection
	order: Record<string, unknown>
}): Promise<SalesOrderItemInput[]> {
	const rawItems = Array.isArray(params.order.order_items)
		? params.order.order_items
		: []
	if (rawItems.length === 0) {
		throw new Error('meli_order_without_items')
	}

	const items: SalesOrderItemInput[] = []
	for (const raw of rawItems) {
		const row = asRecord(raw) ?? {}
		const productId = await resolveMeliProductId({
			supabase: params.supabase,
			organizationId: params.organizationId,
			createdBy: params.createdBy,
			connection: params.connection,
			orderItem: raw,
		})
		const quantity = Math.max(1, Math.round(Number(row.quantity) || 1))
		const unitPriceCents = reaisToCents(row.unit_price ?? row.full_unit_price)
		items.push({
			product_id: productId,
			quantity,
			unit_price_cents: unitPriceCents,
		})
	}
	return items
}

export async function upsertSalesOrderFromMeliOrder(params: {
	supabase: ServiceClient
	organizationId: string
	order: Record<string, unknown>
	connection: HubConnection
}): Promise<{
	orderId: string
	action: 'created' | 'updated' | 'finalized' | 'canceled' | 'skipped'
}> {
	const mlOrderId = trimText(params.order.id)
	if (!mlOrderId) throw new Error('meli_order_id_missing')

	const actorUserId = await resolveActorUserId(
		params.supabase,
		params.organizationId,
		params.connection,
	)
	const auth: AuthCtx = {
		organizationId: params.organizationId,
		userId: actorUserId,
		supabase: params.supabase,
	}

	const mlStatus = mapMeliOrderStatus(params.order)
	const purchasedAt =
		trimText(params.order.date_created) || trimText(params.order.date_closed)
	const draft: SalesOrderDraftInput = {
		...mapBuyerDraft(params.order),
		ml_order_id: mlOrderId,
		created_at: purchasedAt,
	}

	let existing = await findSalesOrderByMlId(
		params.supabase,
		params.organizationId,
		mlOrderId,
	)

	if (existing?.status === 'canceled') {
		return { orderId: existing.id, action: 'skipped' }
	}

	if (existing?.status === 'paid') {
		if (mlStatus === 'canceled') {
			const canceled = await cancelSalesOrder(
				auth,
				existing.id,
				'Cancelado no Mercado Livre',
			)
			if (canceled.ok === false) {
				if (canceled.error !== 'already_canceled') {
					throw new Error(`meli_cancel_failed: ${canceled.error}`)
				}
			}
			await attachMeliFulfillment({
				supabase: params.supabase,
				organizationId: params.organizationId,
				userId: actorUserId,
				connection: params.connection,
				salesOrderId: existing.id,
				order: params.order,
			})
			return { orderId: existing.id, action: 'canceled' }
		}
		await syncMeliPurchaseDate({
			supabase: params.supabase,
			organizationId: params.organizationId,
			salesOrderId: existing.id,
			purchasedAt,
		})
		await attachMeliFulfillment({
			supabase: params.supabase,
			organizationId: params.organizationId,
			userId: actorUserId,
			connection: params.connection,
			salesOrderId: existing.id,
			order: params.order,
		})
		return { orderId: existing.id, action: 'skipped' }
	}

	const items = await mapOrderItems({
		supabase: params.supabase,
		organizationId: params.organizationId,
		createdBy: actorUserId,
		connection: params.connection,
		order: params.order,
	})

	const itemsSubtotal = items.reduce(
		(acc, item) => acc + item.unit_price_cents * item.quantity,
		0,
	)
	const computedTotal = Math.max(
		0,
		itemsSubtotal +
			(draft.surcharge_cents ?? 0) -
			(draft.discount_total_cents ?? 0),
	)
	const paidAmountCents = Math.max(
		computedTotal,
		reaisToCents(params.order.paid_amount ?? params.order.total_amount),
	)

	if (!existing) {
		const created = await createSalesOrder(auth, items, draft, {
			attachCashSession: false,
		})
		if (created.ok === false) {
			const createError = created.error
			existing = await findSalesOrderByMlId(
				params.supabase,
				params.organizationId,
				mlOrderId,
			)
			if (!existing) {
				throw new Error(`meli_create_sales_order_failed: ${createError}`)
			}
		} else {
			existing = { id: created.orderId, status: 'in_progress' }
		}
	} else {
		const updated = await updateSalesOrderDraft(auth, existing.id, draft, items)
		if (updated.ok === false) {
			throw new Error(`meli_update_sales_order_failed: ${updated.error}`)
		}
	}

	if (mlStatus === 'canceled') {
		const canceled = await cancelSalesOrder(
			auth,
			existing.id,
			'Cancelado no Mercado Livre',
		)
		if (canceled.ok === false && canceled.error !== 'already_canceled') {
			throw new Error(`meli_cancel_failed: ${canceled.error}`)
		}
		await attachMeliFulfillment({
			supabase: params.supabase,
			organizationId: params.organizationId,
			userId: actorUserId,
			connection: params.connection,
			salesOrderId: existing.id,
			order: params.order,
		})
		return { orderId: existing.id, action: 'canceled' }
	}

	if (mlStatus !== 'paid') {
		await attachMeliFulfillment({
			supabase: params.supabase,
			organizationId: params.organizationId,
			userId: actorUserId,
			connection: params.connection,
			salesOrderId: existing.id,
			order: params.order,
		})
		return {
			orderId: existing.id,
			action: existing.status === 'in_progress' ? 'updated' : 'created',
		}
	}

	const payments = mapPayments(
		params.order,
		Math.max(1, paidAmountCents || computedTotal),
	)
	const payResult = await replaceSalesOrderPayments(auth, existing.id, payments)
	if (payResult.ok === false) {
		throw new Error(`meli_payments_failed: ${payResult.error}`)
	}

	// Persist logistic type before finalize so FULL skips local stock exit.
	await attachMeliFulfillment({
		supabase: params.supabase,
		organizationId: params.organizationId,
		userId: actorUserId,
		connection: params.connection,
		salesOrderId: existing.id,
		order: params.order,
	})

	const finalized = await finalizeSalesOrder(auth, existing.id)
	if (finalized.ok === false) {
		throw new Error(`meli_finalize_failed: ${finalized.error}`)
	}

	return { orderId: existing.id, action: 'finalized' }
}

async function syncMeliPurchaseDate(params: {
	supabase: ServiceClient
	organizationId: string
	salesOrderId: string
	purchasedAt: string | null
}): Promise<void> {
	const raw = String(params.purchasedAt || '').trim()
	if (!raw || !Number.isFinite(Date.parse(raw))) return
	const purchasedAtIso = new Date(raw).toISOString()
	const { data } = await params.supabase
		.from('sales_orders')
		.select('created_at')
		.eq('organization_id', params.organizationId)
		.eq('id', params.salesOrderId)
		.maybeSingle()
	const current = String(data?.created_at || '').trim()
	if (current && Math.abs(Date.parse(current) - Date.parse(purchasedAtIso)) < 1000) {
		return
	}
	const { error } = await params.supabase
		.from('sales_orders')
		.update({ created_at: purchasedAtIso })
		.eq('organization_id', params.organizationId)
		.eq('id', params.salesOrderId)
	if (error) {
		console.error('[meli purchase date]', error.message)
	}
}

async function attachMeliFulfillment(params: {
	supabase: ServiceClient
	organizationId: string
	userId: string
	connection: HubConnection
	salesOrderId: string
	order: Record<string, unknown>
}): Promise<void> {
	const shipping = asRecord(params.order.shipping)
	const shipmentId = trimText(shipping?.id)
	let shipment: Record<string, unknown> | null = null
	if (shipmentId) {
		try {
			shipment = await getMeliShipment(
				params.connection,
				shipmentId,
				params.supabase,
			)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown_error'
			console.error('[meli shipment]', message)
		}
	}
	await syncMeliPurchaseDate({
		supabase: params.supabase,
		organizationId: params.organizationId,
		salesOrderId: params.salesOrderId,
		purchasedAt:
			trimText(params.order.date_created) || trimText(params.order.date_closed),
	})
	const mlOrderId = trimText(params.order.id)
	const packId = trimText(params.order.pack_id)
	const claims = mlOrderId
		? await searchMeliClaimsByOrderId(
			params.connection,
			mlOrderId,
			params.supabase,
			{ packId },
		).catch(() => [])
		: []
	const claim = pickMeliClaimForDisplay(claims)

	await persistMeliFulfillment({
		supabase: params.supabase,
		organizationId: params.organizationId,
		salesOrderId: params.salesOrderId,
		order: params.order,
		shipment,
		claimStatus: claim?.status ?? null,
	})

	const auth: AuthCtx = {
		organizationId: params.organizationId,
		userId: params.userId,
		supabase: params.supabase,
	}
	const fullStock = await reverseSalesOrderStockIfFull(auth, params.salesOrderId)
	if (fullStock.ok === false) {
		console.error('[meli full stock reverse]', fullStock.error)
	}
}

export async function syncMeliShipmentById(params: {
	supabase: ServiceClient
	organizationId: string
	shipmentId: string
}): Promise<{ orderId: string; action: string }> {
	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) throw new Error('meli_not_connected')

	const shipment = await getMeliShipment(
		connection,
		params.shipmentId,
		params.supabase,
	)
	const orderId = trimText(shipment.order_id)
	if (!orderId) throw new Error('meli_shipment_without_order')

	return syncMeliOrderById({
		supabase: params.supabase,
		organizationId: params.organizationId,
		orderId,
	})
}

export async function syncMeliOrderById(params: {
	supabase: ServiceClient
	organizationId: string
	orderId: string
}): Promise<{ orderId: string; action: string }> {
	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) throw new Error('meli_not_connected')

	const order = await getMeliOrder(connection, params.orderId, params.supabase)
	return upsertSalesOrderFromMeliOrder({
		supabase: params.supabase,
		organizationId: params.organizationId,
		order,
		connection,
	})
}

const purchaseBackfillAtByOrg = new Map<string, number>()
const PURCHASE_BACKFILL_TTL_MS = 60 * 60 * 1000

/** Corrige created_at dos pedidos MELI para a data da compra (date_created). */
export async function backfillMeliPurchaseDates(params: {
	supabase: ServiceClient
	organizationId: string
	limit?: number
	force?: boolean
}): Promise<{ updated: number, failed: number, skipped: boolean }> {
	const now = Date.now()
	const lastAt = purchaseBackfillAtByOrg.get(params.organizationId) ?? 0
	if (!params.force && now - lastAt < PURCHASE_BACKFILL_TTL_MS) {
		return { updated: 0, failed: 0, skipped: true }
	}

	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) return { updated: 0, failed: 0, skipped: false }

	const limit = Math.min(200, Math.max(1, Math.trunc(params.limit ?? 100)))
	const { data: rows, error } = await params.supabase
		.from('sales_orders')
		.select('id, ml_order_id, created_at')
		.eq('organization_id', params.organizationId)
		.not('ml_order_id', 'is', null)
		.order('updated_at', { ascending: false })
		.limit(limit)

	if (error || !rows?.length) {
		if (error) console.error('[meli purchase backfill]', error.message)
		return { updated: 0, failed: 0, skipped: false }
	}

	let updated = 0
	let failed = 0
	let cursor = 0
	const workers = Math.min(4, rows.length)

	async function worker () {
		for (;;) {
			const index = cursor
			cursor += 1
			const row = rows[index]
			if (!row) return
			const mlOrderId = String(row.ml_order_id || '').trim()
			const salesOrderId = String(row.id || '').trim()
			if (!mlOrderId || !salesOrderId) continue
			try {
				const order = await getMeliOrder(connection, mlOrderId, params.supabase)
				const purchasedAt =
					trimText(order.date_created) || trimText(order.date_closed)
				await syncMeliPurchaseDate({
					supabase: params.supabase,
					organizationId: params.organizationId,
					salesOrderId,
					purchasedAt,
				})
				updated += 1
			} catch (err) {
				failed += 1
				const message = err instanceof Error ? err.message : 'unknown_error'
				console.error('[meli purchase backfill]', mlOrderId, message)
			}
		}
	}

	await Promise.all(Array.from({ length: workers }, () => worker()))
	purchaseBackfillAtByOrg.set(params.organizationId, Date.now())
	return { updated, failed, skipped: false }
}

export function orderIdFromMeliResource(
	resource: string | null | undefined,
): string | null {
	return extractMeliOrderIdFromResource(resource)
}
