import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	getMeliOrder,
	type HubConnection,
} from '@/lib/integrations/mercado-livre/api'
import { resolveMeliProductId } from '@/lib/integrations/mercado-livre/product-resolve'
import { extractMeliOrderIdFromResource } from '@/lib/integrations/mercado-livre/webhooks'
import {
	cancelSalesOrder,
	createSalesOrder,
	finalizeSalesOrder,
	replaceSalesOrderPayments,
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
	const draft: SalesOrderDraftInput = {
		...mapBuyerDraft(params.order),
		ml_order_id: mlOrderId,
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
			return { orderId: existing.id, action: 'canceled' }
		}
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
		return { orderId: existing.id, action: 'canceled' }
	}

	if (mlStatus !== 'paid') {
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

	const finalized = await finalizeSalesOrder(auth, existing.id)
	if (finalized.ok === false) {
		throw new Error(`meli_finalize_failed: ${finalized.error}`)
	}

	return { orderId: existing.id, action: 'finalized' }
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

export function orderIdFromMeliResource(
	resource: string | null | undefined,
): string | null {
	return extractMeliOrderIdFromResource(resource)
}
