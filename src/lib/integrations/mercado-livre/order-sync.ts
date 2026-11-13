import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	getMeliItem,
	getMeliOrder,
	getMeliShipment,
	getMeliShipmentCosts,
	loadMeliUserProductStockById,
	type HubConnection,
	pickMeliClaimForDisplay,
	searchMeliClaimsByOrderId,
} from '@/lib/integrations/mercado-livre/api'
import { persistMeliFulfillment } from '@/lib/integrations/mercado-livre/fulfillment'
import {
	stockFromMeliItem,
	stockFromMeliLocations,
} from '@/lib/integrations/mercado-livre/listing-display'
import {
	meliOrderItemDiscountCents,
	meliSaleDisplayFromPayloads,
} from '@/lib/vendas/meli-sale-display'
import {
	parseMeliOrderItemRef,
	resolveMeliProductId,
} from '@/lib/integrations/mercado-livre/product-resolve'
import { userProductIdFromMeliItem } from '@/lib/integrations/mercado-livre/listing-variations'
import {
	isMeliOpenFulfillmentStage,
	meliLogisticTypeFromShipment,
	resolveMeliFulfillmentStage,
} from '@/lib/vendas/sales-lane'
import { extractMeliOrderIdFromResource } from '@/lib/integrations/mercado-livre/webhooks'
import {
	cancelSalesOrder,
	createSalesOrder,
	finalizeSalesOrder,
	listSalesOrderItems,
	replaceSalesOrderPayments,
	reverseSalesOrderStockIfFull,
	type SalesOrderDraftInput,
	type SalesOrderItemInput,
	type SalesOrderPaymentInput,
	updateSalesOrderDraft,
} from '@/lib/sales-orders/service'
import { isValidCpf } from '@/lib/utils/strings'

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

function nestedText(value: unknown): string | null {
	const record = asRecord(value)
	return (
		trimText(record?.name) ||
		trimText(record?.value_name) ||
		trimText(record?.value)
	)
}

async function upsertMeliCustomer(params: {
	supabase: ServiceClient
	organizationId: string
	connection: HubConnection
	order: Record<string, unknown>
}): Promise<string | null> {
	const buyer = asRecord(params.order.buyer) ?? {}
	const billing = asRecord(buyer.billing_info) ?? {}
	const document = trimText(buyer.doc_number) || trimText(billing.doc_number)
	const cpf = document ? digitsOnly(document) : ''
	const docType = String(buyer.doc_type || billing.doc_type || '').toUpperCase()
	if (cpf.length !== 11 || docType.includes('CNPJ')) return null

	const firstName = trimText(buyer.first_name)
	const lastName = trimText(buyer.last_name)
	const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
	const shipping = asRecord(params.order.shipping) ?? {}
	let receiver = asRecord(shipping.receiver_address) ?? {}
	if (
		!trimText(receiver.zip_code) &&
		!trimText(receiver.street_name) &&
		trimText(shipping.id)
	) {
		try {
			const shipment = await getMeliShipment(
				params.connection,
				String(shipping.id),
				params.supabase,
			)
			receiver = asRecord(shipment.receiver_address) ?? receiver
		} catch (error) {
			console.error(
				'[meli customer address]',
				error instanceof Error ? error.message : 'shipment_lookup_failed',
			)
		}
	}

	const city = nestedText(receiver.city)
	const state = nestedText(receiver.state)
	const neighborhood = nestedText(receiver.neighborhood)
	const street =
		trimText(receiver.street_name) || trimText(receiver.address_line)
	const streetNumber = trimText(receiver.street_number)
	const streetComplement =
		trimText(receiver.floor) || trimText(receiver.apartment)
	const addressFull = [
		street && streetNumber
			? street + ', ' + streetNumber
			: street || streetNumber,
		streetComplement,
		neighborhood,
		[city, state].filter(Boolean).join(' - ') || null,
		trimText(receiver.comment),
	]
		.filter((part): part is string => Boolean(part))
		.join(', ')

	const customerFields: Record<string, unknown> = { cpf }
	if (fullName) customerFields.full_name = fullName
	if (trimText(receiver.zip_code))
		customerFields.zip_code = trimText(receiver.zip_code)
	if (addressFull) customerFields.address_full = addressFull
	if (city) customerFields.city = city
	if (state) customerFields.state = state
	if (neighborhood) customerFields.neighborhood = neighborhood
	if (street) customerFields.street = street
	if (streetNumber) customerFields.street_number = streetNumber
	if (streetComplement) customerFields.street_complement = streetComplement

	const { data: existing, error: lookupError } = await params.supabase
		.from('customers')
		.select('id')
		.eq('organization_id', params.organizationId)
		.eq('cpf', cpf)
		.maybeSingle()
	if (lookupError) throw new Error('meli_customer_lookup_failed')

	if (existing?.id) {
		const { error } = await params.supabase
			.from('customers')
			.update(customerFields)
			.eq('organization_id', params.organizationId)
			.eq('id', existing.id)
		if (error) throw new Error('meli_customer_update_failed')
		return String(existing.id)
	}

	const { data: inserted, error: insertError } = await params.supabase
		.from('customers')
		.insert({
			organization_id: params.organizationId,
			is_company: false,
			...customerFields,
			full_name: fullName || 'Cliente Mercado Livre',
		})
		.select('id')
		.single()
	if (!insertError && inserted?.id) return String(inserted.id)

	// Uma venda pode chegar pelo webhook e pelo reconciliador ao mesmo tempo.
	const { data: racedCustomer } = await params.supabase
		.from('customers')
		.select('id')
		.eq('organization_id', params.organizationId)
		.eq('cpf', cpf)
		.maybeSingle()
	if (!racedCustomer?.id) throw new Error('meli_customer_create_failed')
	const { error: updateError } = await params.supabase
		.from('customers')
		.update(customerFields)
		.eq('organization_id', params.organizationId)
		.eq('id', racedCustomer.id)
	if (updateError) throw new Error('meli_customer_update_failed')
	return String(racedCustomer.id)
}

async function linkSalesOrderCustomer(params: {
	supabase: ServiceClient
	organizationId: string
	salesOrderId: string
	customerId: string | null
}): Promise<void> {
	if (!params.customerId) return
	const { error } = await params.supabase
		.from('sales_orders')
		.update({ customer_id: params.customerId })
		.eq('organization_id', params.organizationId)
		.eq('id', params.salesOrderId)
	if (error) throw new Error('meli_customer_link_failed')
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

async function resolveUserProductIdForMlItem(params: {
	supabase: ServiceClient
	organizationId: string
	connection: HubConnection
	mlItemId: string
}): Promise<string | null> {
	const mlItemId = String(params.mlItemId || '').trim()
	if (!mlItemId) return null

	const { data: listing } = await params.supabase
		.from('meli_listings')
		.select('raw')
		.eq('organization_id', params.organizationId)
		.eq('ml_item_id', mlItemId)
		.maybeSingle()

	const listingRaw = asRecord(listing?.raw)
	const fromListing = trimText(listingRaw?.user_product_id)
	if (fromListing) return fromListing

	try {
		const item = await getMeliItem(params.connection, mlItemId, params.supabase)
		return userProductIdFromMeliItem(item)
	} catch {
		return null
	}
}

/**
 * Remanescente Full após a venda.
 * Estoque atual no CD + unidades Full vendidas depois desta compra.
 * Ex.: 10 → vende 1 → 9; próxima venda → 8.
 */
export function remanescenteFullAfterSale(
	currentFullStock: number,
	laterFullSoldQty: number,
): number {
	const current = Math.max(0, Math.round(Number(currentFullStock) || 0))
	const later = Math.max(0, Math.round(Number(laterFullSoldQty) || 0))
	return current + later
}

type LaterFullSaleLine = {
	productId: string
	orderId: string
	createdAt: string
	quantity: number
}

/**
 * Carrega vendas Full (não canceladas) dos produtos após `afterCreatedAt`
 * para reconstruir o remanescente histórico.
 */
export async function loadLaterFullSaleLines(params: {
	supabase: ServiceClient
	organizationId: string
	productIds: string[]
	afterCreatedAt: string
}): Promise<LaterFullSaleLine[]> {
	const productIds = [...new Set(
		params.productIds.map((id) => String(id || '').trim()).filter(Boolean),
	)]
	const afterCreatedAt = String(params.afterCreatedAt || '').trim()
	if (productIds.length === 0 || !afterCreatedAt) return []

	const { data, error } = await params.supabase
		.from('sales_order_items')
		.select(`
			product_id,
			quantity,
			sales_order_id,
			sales_orders!inner (
				id,
				created_at,
				status,
				ml_logistic_type
			)
		`)
		.eq('organization_id', params.organizationId)
		.in('product_id', productIds)
		.eq('sales_orders.ml_logistic_type', 'fulfillment')
		.neq('sales_orders.status', 'canceled')
		.gt('sales_orders.created_at', afterCreatedAt)
		.limit(2000)

	if (error) {
		console.error('[meli later full sales]', error.message)
		return []
	}

	const out: LaterFullSaleLine[] = []
	for (const row of data ?? []) {
		const orderRaw = (row as {
			sales_orders?: Record<string, unknown> | Record<string, unknown>[] | null
		}).sales_orders
		const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
		const productId = String((row as { product_id?: string }).product_id || '').trim()
		const orderId = String(
			(row as { sales_order_id?: string }).sales_order_id
			|| order?.id
			|| '',
		).trim()
		const createdAt = String(order?.created_at || '').trim()
		const quantity = Math.max(
			0,
			Math.round(Number((row as { quantity?: number }).quantity) || 0),
		)
		if (!productId || !orderId || !createdAt || quantity <= 0) continue
		out.push({ productId, orderId, createdAt, quantity })
	}
	return out
}

export function laterFullSoldQtyForSale(params: {
	lines: LaterFullSaleLine[]
	productId: string
	orderId: string
	createdAt: string
}): number {
	const productId = String(params.productId || '').trim()
	const orderId = String(params.orderId || '').trim()
	const createdAt = String(params.createdAt || '').trim()
	if (!productId || !createdAt) return 0
	let total = 0
	for (const line of params.lines) {
		if (line.productId !== productId) continue
		if (orderId && line.orderId === orderId) continue
		if (line.createdAt <= createdAt) continue
		total += line.quantity
	}
	return total
}

/**
 * Consulta o estoque Full (meli_facility) e grava o remanescente após esta venda.
 * No sync recente o estoque atual já é o pós-venda; se o pedido é antigo,
 * soma as unidades Full vendidas depois para reconstruir o histórico (10→9→8).
 */
async function attachMeliFullStockAfterSale(params: {
	supabase: ServiceClient
	organizationId: string
	connection: HubConnection
	order: Record<string, unknown>
	items: Array<SalesOrderItemInput & { mlItemId?: string | null }>
	/** Quando o banco/shipment já confirmou FULL (order.shipping pode ainda não ter). */
	knownLogisticType?: string | null
	/** Pedido já persistido (backfill): exclui a si nas vendas posteriores. */
	excludeOrderId?: string | null
}): Promise<SalesOrderItemInput[]> {
	const logistic = String(params.knownLogisticType || '').trim().toLowerCase()
		|| meliLogisticTypeFromShipment({
			shipping: params.order.shipping,
			shipment: null,
			tags: params.order.tags,
		})
	if (logistic !== 'fulfillment') {
		return params.items.map(({ mlItemId: _mlItemId, ...item }) => item)
	}

	const userProductByIndex = new Map<number, string>()
	const mlItemByIndex = new Map<number, string>()
	await Promise.all(
		params.items.map(async (item, index) => {
			const mlItemId = String(item.mlItemId || '').trim()
			if (!mlItemId) return
			mlItemByIndex.set(index, mlItemId)
			const userProductId = await resolveUserProductIdForMlItem({
				supabase: params.supabase,
				organizationId: params.organizationId,
				connection: params.connection,
				mlItemId,
			})
			if (!userProductId) return
			userProductByIndex.set(index, userProductId)
		}),
	)

	const userProductIds = [...new Set(userProductByIndex.values())]
	const locationsByUserProduct = userProductIds.length > 0
		? await loadMeliUserProductStockById(
			params.connection,
			userProductIds,
			params.supabase,
		)
		: new Map<string, unknown>()

	const stockByIndex = new Map<number, number>()
	await Promise.all(
		params.items.map(async (_item, index) => {
			const userProductId = userProductByIndex.get(index)
			if (userProductId) {
				const locations = locationsByUserProduct.get(userProductId)
				const fromLocations = locations != null
					? stockFromMeliLocations(locations).stock_full
					: null
				if (fromLocations != null) {
					stockByIndex.set(index, Math.max(0, Math.round(fromLocations)))
					return
				}
			}
			const mlItemId = mlItemByIndex.get(index)
			if (!mlItemId) return
			try {
				const meliItem = await getMeliItem(
					params.connection,
					mlItemId,
					params.supabase,
				)
				const fromItem = stockFromMeliItem(meliItem).stock_full
				if (fromItem != null) {
					stockByIndex.set(index, Math.max(0, Math.round(fromItem)))
				}
			} catch {
				// Mantém sem snapshot; a listagem pode tentar de novo.
			}
		}),
	)

	const orderCreatedAt =
		trimText(params.order.date_created)
		|| trimText(params.order.date_closed)
		|| null
	const productIds = params.items
		.map((item) => String(item.product_id || '').trim())
		.filter(Boolean)
	const laterLines = orderCreatedAt && productIds.length > 0
		? await loadLaterFullSaleLines({
			supabase: params.supabase,
			organizationId: params.organizationId,
			productIds,
			afterCreatedAt: orderCreatedAt,
		})
		: []
	const excludeOrderId = String(params.excludeOrderId || '').trim()

	return params.items.map((item, index) => {
		const { mlItemId: _mlItemId, ...rest } = item
		const currentFull = stockByIndex.get(index)
		if (currentFull == null) return rest
		const laterQty = orderCreatedAt
			? laterFullSoldQtyForSale({
				lines: laterLines,
				productId: item.product_id,
				orderId: excludeOrderId,
				createdAt: orderCreatedAt,
			})
			: 0
		return {
			...rest,
			stock_after_sale: remanescenteFullAfterSale(currentFull, laterQty),
		}
	})
}

/** Resolve estoque Full atual por anúncio MELI (para listagem / backfill). */
export async function resolveMeliFullStockByMlItemIds(params: {
	supabase: ServiceClient
	organizationId: string
	connection: HubConnection
	mlItemIds: string[]
}): Promise<Map<string, number>> {
	const unique = [...new Set(
		params.mlItemIds.map((id) => String(id || '').trim()).filter(Boolean),
	)]
	const out = new Map<string, number>()
	if (unique.length === 0) return out

	const userProductByMlItem = new Map<string, string>()
	await Promise.all(
		unique.map(async (mlItemId) => {
			const userProductId = await resolveUserProductIdForMlItem({
				supabase: params.supabase,
				organizationId: params.organizationId,
				connection: params.connection,
				mlItemId,
			})
			if (userProductId) userProductByMlItem.set(mlItemId, userProductId)
		}),
	)

	const locationsByUserProduct = userProductByMlItem.size > 0
		? await loadMeliUserProductStockById(
			params.connection,
			[...new Set(userProductByMlItem.values())],
			params.supabase,
		)
		: new Map<string, unknown>()

	await Promise.all(
		unique.map(async (mlItemId) => {
			const userProductId = userProductByMlItem.get(mlItemId)
			if (userProductId) {
				const locations = locationsByUserProduct.get(userProductId)
				const fromLocations = locations != null
					? stockFromMeliLocations(locations).stock_full
					: null
				if (fromLocations != null) {
					out.set(mlItemId, Math.max(0, Math.round(fromLocations)))
					return
				}
			}
			try {
				const meliItem = await getMeliItem(
					params.connection,
					mlItemId,
					params.supabase,
				)
				const fromItem = stockFromMeliItem(meliItem).stock_full
				if (fromItem != null) {
					out.set(mlItemId, Math.max(0, Math.round(fromItem)))
				}
			} catch {
				// ignore
			}
		}),
	)

	return out
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

	const drafted: Array<SalesOrderItemInput & { mlItemId?: string | null }> = []
	for (const raw of rawItems) {
		const row = asRecord(raw) ?? {}
		const itemRef = parseMeliOrderItemRef(raw)
		const productId = await resolveMeliProductId({
			supabase: params.supabase,
			organizationId: params.organizationId,
			createdBy: params.createdBy,
			connection: params.connection,
			orderItem: raw,
		})
		const quantity = Math.max(1, Math.round(Number(row.quantity) || 1))
		const unitPriceCents = reaisToCents(row.unit_price ?? row.full_unit_price)
		const discount = meliOrderItemDiscountCents(row)
		drafted.push({
			product_id: productId,
			quantity,
			unit_price_cents: unitPriceCents,
			ml_discount_total_cents: discount.totalCents > 0 ? discount.totalCents : null,
			ml_discount_seller_cents: discount.sellerCents > 0 ? discount.sellerCents : null,
			mlItemId: itemRef?.itemId ?? null,
		})
	}

	return attachMeliFullStockAfterSale({
		supabase: params.supabase,
		organizationId: params.organizationId,
		connection: params.connection,
		order: params.order,
		items: drafted,
	})
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
	const items = await mapOrderItems({
		supabase: params.supabase,
		organizationId: params.organizationId,
		createdBy: actorUserId,
		connection: params.connection,
		order: params.order,
	})
	const canonicalItems = canonicalizeMeliItems(items)
	const customerId =
		mlStatus === 'paid'
			? await upsertMeliCustomer({
					supabase: params.supabase,
					organizationId: params.organizationId,
					connection: params.connection,
					order: params.order,
				})
			: null

	let existing = await findSalesOrderByMlId(
		params.supabase,
		params.organizationId,
		mlOrderId,
	)

	if (existing?.status === 'canceled') {
		return { orderId: existing.id, action: 'skipped' }
	}

	if (existing?.status === 'paid') {
		await linkSalesOrderCustomer({
			supabase: params.supabase,
			organizationId: params.organizationId,
			salesOrderId: existing.id,
			customerId,
		})
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
		const currentItems = await listSalesOrderItems(auth, existing.id)
		if (!currentItems.ok) throw new Error('meli_order_items_load_failed')
		let itemsUpdated = false
		const missingPromoDiscount = canonicalItems.some((item) => (
			(item.ml_discount_total_cents ?? 0) > 0
		)) && currentItems.items.some((item) => {
			const row = item as { ml_discount_total_cents?: number | null }
			return row.ml_discount_total_cents == null
		})
		if (!sameMeliItems(currentItems.items, canonicalItems) || missingPromoDiscount) {
			itemsUpdated = true
			const repaired = await updateSalesOrderDraft(
				auth,
				existing.id,
				draft,
				canonicalItems,
			)
			if (repaired.ok === false)
				throw new Error(`meli_paid_order_repair_failed: ${repaired.error}`)
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
		return {
			orderId: existing.id,
			action: itemsUpdated ? 'updated' : 'skipped',
		}
	}

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
		const created = await createSalesOrder(auth, canonicalItems, draft, {
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
		const updated = await updateSalesOrderDraft(
			auth,
			existing.id,
			draft,
			canonicalItems,
		)
		if (updated.ok === false) {
			throw new Error(`meli_update_sales_order_failed: ${updated.error}`)
		}
	}
	await linkSalesOrderCustomer({
		supabase: params.supabase,
		organizationId: params.organizationId,
		salesOrderId: existing.id,
		customerId,
	})

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

function canonicalizeMeliItems(
	items: SalesOrderItemInput[],
): SalesOrderItemInput[] {
	const grouped = new Map<string, SalesOrderItemInput>()
	for (const item of items) {
		const key = [
			item.product_id,
			item.unit_price_cents,
			item.discount_cents ?? 0,
		].join(':')
		const previous = grouped.get(key)
		if (previous) {
			previous.quantity += item.quantity
			if (previous.stock_after_sale == null && item.stock_after_sale != null) {
				previous.stock_after_sale = item.stock_after_sale
			} else if (
				previous.stock_after_sale != null
				&& item.stock_after_sale != null
			) {
				previous.stock_after_sale = Math.min(
					previous.stock_after_sale,
					item.stock_after_sale,
				)
			}
			const nextTotal = item.ml_discount_total_cents
			if (nextTotal != null && nextTotal > 0) {
				previous.ml_discount_total_cents =
					(previous.ml_discount_total_cents ?? 0) + nextTotal
			}
			const nextSeller = item.ml_discount_seller_cents
			if (nextSeller != null && nextSeller > 0) {
				previous.ml_discount_seller_cents =
					(previous.ml_discount_seller_cents ?? 0) + nextSeller
			}
		} else {
			grouped.set(key, { ...item })
		}
	}
	return [...grouped.values()].sort((a, b) =>
		[a.product_id, a.unit_price_cents, a.discount_cents ?? 0]
			.join(':')
			.localeCompare(
				[b.product_id, b.unit_price_cents, b.discount_cents ?? 0].join(':'),
			),
	)
}

/** Preenche stock_after_sale em itens Full que ainda não têm snapshot. */
async function backfillMissingMeliStockAfterSale(params: {
	supabase: ServiceClient
	organizationId: string
	connection: HubConnection
	salesOrderId: string
	order: Record<string, unknown>
	auth: AuthCtx
}) {
	const logisticFromOrder = meliLogisticTypeFromShipment({
		shipping: params.order.shipping,
		shipment: null,
		tags: params.order.tags,
	})
	let logistic = logisticFromOrder
	if (logistic !== 'fulfillment') {
		const { data: orderRow } = await params.supabase
			.from('sales_orders')
			.select('ml_logistic_type')
			.eq('organization_id', params.organizationId)
			.eq('id', params.salesOrderId)
			.maybeSingle()
		logistic = trimText(orderRow?.ml_logistic_type)?.toLowerCase() ?? null
	}
	if (logistic !== 'fulfillment') return

	const listed = await listSalesOrderItems(params.auth, params.salesOrderId)
	if (!listed.ok || listed.items.length === 0) return
	const missing = listed.items.some((item) => item.stock_after_sale == null)
	if (!missing) return

	const productIds = listed.items.map((item) => item.product_id)
	const { data: products } = await params.supabase
		.from('products')
		.select('id, ml_item_id')
		.eq('organization_id', params.organizationId)
		.in('id', productIds)
	const mlItemByProductId = new Map(
		(products ?? []).map((row) => [
			String(row.id),
			trimText(row.ml_item_id),
		]),
	)

	const drafted: Array<SalesOrderItemInput & { mlItemId?: string | null }> =
		listed.items.map((item) => {
			const row = item as {
				ml_discount_total_cents?: number | null
				ml_discount_seller_cents?: number | null
			}
			return {
				product_id: item.product_id,
				quantity: item.quantity,
				unit_price_cents: item.unit_price_cents,
				unit_cost_cents: item.unit_cost_cents ?? 0,
				discount_cents: item.discount_cents ?? 0,
				stock_after_sale: item.stock_after_sale ?? null,
				ml_discount_total_cents: row.ml_discount_total_cents ?? null,
				ml_discount_seller_cents: row.ml_discount_seller_cents ?? null,
				mlItemId: mlItemByProductId.get(item.product_id) ?? null,
			}
		})

	const enriched = await attachMeliFullStockAfterSale({
		supabase: params.supabase,
		organizationId: params.organizationId,
		connection: params.connection,
		order: params.order,
		items: drafted,
		knownLogisticType: 'fulfillment',
		excludeOrderId: params.salesOrderId,
	})
	const withStock = enriched.filter((item) => item.stock_after_sale != null)
	if (withStock.length === 0) return

	// Atualiza só o snapshot: evita replace de itens em pedido pago (reversão de estoque).
	await Promise.all(
		withStock.map(async (item) => {
			const { error } = await params.supabase
				.from('sales_order_items')
				.update({ stock_after_sale: item.stock_after_sale })
				.eq('organization_id', params.organizationId)
				.eq('sales_order_id', params.salesOrderId)
				.eq('product_id', item.product_id)
				.is('stock_after_sale', null)
			if (error) {
				console.error('[meli stock_after_sale backfill]', error.message)
			}
		}),
	)
}

function sameMeliItems(
	current: Array<
		Pick<
			SalesOrderItemInput,
			'product_id' | 'quantity' | 'unit_price_cents' | 'discount_cents'
		>
	>,
	expected: SalesOrderItemInput[],
): boolean {
	const normalized = canonicalizeMeliItems(current.map((item) => ({ ...item })))
	return (
		normalized.length === expected.length &&
		normalized.every((item, index) => {
			const wanted = expected[index]
			return (
				item.product_id === wanted.product_id &&
				item.quantity === wanted.quantity &&
				item.unit_price_cents === wanted.unit_price_cents &&
				(item.discount_cents ?? 0) === (wanted.discount_cents ?? 0)
			)
		})
	)
}

async function withMeliOrderLock<T>(
	supabase: ServiceClient,
	organizationId: string,
	orderId: string,
	work: () => Promise<T>,
): Promise<T> {
	const token = randomUUID()
	let acquired = false
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const { data, error } = await supabase.rpc(
			'try_acquire_meli_order_sync_lock',
			{
				p_organization_id: organizationId,
				p_ml_order_id: orderId,
				p_lock_token: token,
			},
		)
		if (error) {
			if (error.code === 'PGRST202' || error.code === '42883') {
				console.error(
					'[meli order lock] migration 20261026120000_meli_order_sync_lock.sql must be applied',
				)
				return work()
			}
			throw new Error(`meli_order_lock_failed: ${error.message}`)
		}
		if (data === true) {
			acquired = true
			break
		}
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
	if (!acquired) throw new Error('meli_order_sync_lock_timeout')
	try {
		return await work()
	} finally {
		const { error } = await supabase.rpc('release_meli_order_sync_lock', {
			p_organization_id: organizationId,
			p_ml_order_id: orderId,
			p_lock_token: token,
		})
		if (error) console.error('[meli order lock release]', error.message)
	}
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
	if (
		current &&
		Math.abs(Date.parse(current) - Date.parse(purchasedAtIso)) < 1000
	) {
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
	let costs: Record<string, unknown> | null = null
	if (shipmentId) {
		try {
			const [shipmentRow, costsRow] = await Promise.all([
				getMeliShipment(
					params.connection,
					shipmentId,
					params.supabase,
				).catch(() => null),
				getMeliShipmentCosts(
					params.connection,
					shipmentId,
					params.supabase,
				).catch(() => null),
			])
			shipment = shipmentRow
			costs = costsRow
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
	const sale = meliSaleDisplayFromPayloads({
		order: params.order,
		shipment,
		costs,
		sla: null,
	})

	await persistMeliFulfillment({
		supabase: params.supabase,
		organizationId: params.organizationId,
		salesOrderId: params.salesOrderId,
		order: params.order,
		shipment,
		claimStatus: claim?.status ?? null,
		shippingMethod: sale.shippingMethodName,
		saleFeeCents: sale.saleFeeCents ?? 0,
		shippingGrossCents: sale.shippingGrossCents ?? 0,
		shippingRefundCents: sale.shippingRefundCents ?? 0,
	})

	const auth: AuthCtx = {
		organizationId: params.organizationId,
		userId: params.userId,
		supabase: params.supabase,
	}
	const fullStock = await reverseSalesOrderStockIfFull(
		auth,
		params.salesOrderId,
	)
	if (fullStock.ok === false) {
		console.error('[meli full stock reverse]', fullStock.error)
	}

	await backfillMissingMeliStockAfterSale({
		supabase: params.supabase,
		organizationId: params.organizationId,
		connection: params.connection,
		salesOrderId: params.salesOrderId,
		order: params.order,
		auth,
	})
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
	return withMeliOrderLock(
		params.supabase,
		params.organizationId,
		params.orderId,
		async () => {
			const connection = await getMeliConnectionByOrganizationId(
				params.supabase,
				params.organizationId,
			)
			if (!connection) throw new Error('meli_not_connected')
			const order = await getMeliOrder(
				connection,
				params.orderId,
				params.supabase,
			)
			return upsertSalesOrderFromMeliOrder({
				supabase: params.supabase,
				organizationId: params.organizationId,
				order,
				connection,
			})
		},
	)
}

const purchaseBackfillAtByOrg = new Map<string, number>()
const PURCHASE_BACKFILL_TTL_MS = 60 * 60 * 1000

/** Corrige created_at dos pedidos MELI para a data da compra (date_created). */
export async function backfillMeliPurchaseDates(params: {
	supabase: ServiceClient
	organizationId: string
	limit?: number
	force?: boolean
}): Promise<{ updated: number; failed: number; skipped: boolean }> {
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

	async function worker() {
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

type ShippingBoardCancelRow = {
	id?: string | null
	status?: string | null
	ml_order_id?: string | null
	ml_fulfillment_stage?: string | null
	ml_shipment_status?: string | null
	ml_shipment_substatus?: string | null
}

/**
 * Pedidos ainda "paid" no banco, mas cancelados no MELI: cancela localmente
 * para o painel/lista de canceladas refletirem (ex.: não enviar).
 */
export async function reconcileOpenMeliCancelsForShippingBoard<T extends ShippingBoardCancelRow>(params: {
	supabase: ServiceClient
	organizationId: string
	rows: T[]
	limit?: number
}): Promise<T[]> {
	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) return params.rows

	const openPaid = params.rows.filter((row) => {
		const status = String(row.status || '').trim().toLowerCase()
		if (status !== 'paid') return false
		const mlOrderId = String(row.ml_order_id || '').trim()
		if (!mlOrderId) return false
		const shipStatus = String(row.ml_shipment_status || '').trim().toLowerCase()
		if (shipStatus === 'cancelled' || shipStatus === 'canceled') return false
		const stage = resolveMeliFulfillmentStage({
			ml_fulfillment_stage: row.ml_fulfillment_stage,
			ml_shipment_status: row.ml_shipment_status,
			ml_shipment_substatus: row.ml_shipment_substatus,
		})
		return isMeliOpenFulfillmentStage(stage)
	}).slice(0, Math.min(20, Math.max(1, Math.trunc(params.limit ?? 12))))

	if (openPaid.length === 0) return params.rows

	const actorUserId = await resolveActorUserId(
		params.supabase,
		params.organizationId,
		connection,
	)
	const auth: AuthCtx = {
		organizationId: params.organizationId,
		userId: actorUserId,
		supabase: params.supabase,
	}

	const canceledIds = new Set<string>()
	let cursor = 0
	async function worker () {
		for (;;) {
			const index = cursor
			cursor += 1
			const row = openPaid[index]
			if (!row) return
			const mlOrderId = String(row.ml_order_id || '').trim()
			const salesOrderId = String(row.id || '').trim()
			if (!mlOrderId || !salesOrderId) continue
			try {
				const order = await getMeliOrder(connection, mlOrderId, params.supabase)
				if (mapMeliOrderStatus(order) !== 'canceled') continue
				const canceled = await cancelSalesOrder(
					auth,
					salesOrderId,
					'Cancelado no Mercado Livre',
				)
				if (canceled.ok === false && canceled.error !== 'already_canceled') {
					console.error('[meli board cancel]', canceled.error)
					continue
				}
				canceledIds.add(salesOrderId)
				await attachMeliFulfillment({
					supabase: params.supabase,
					organizationId: params.organizationId,
					userId: actorUserId,
					connection,
					salesOrderId,
					order,
				})
			} catch (err) {
				const message = err instanceof Error ? err.message : 'unknown_error'
				console.error('[meli board cancel]', mlOrderId, message)
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(4, openPaid.length) }, () => worker()),
	)

	if (canceledIds.size === 0) return params.rows
	return params.rows.map((row) => {
		const id = String(row.id || '').trim()
		if (!id || !canceledIds.has(id)) return row
		return {
			...row,
			status: 'canceled',
			ml_shipment_status: row.ml_shipment_status || 'cancelled',
		}
	})
}
