import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
	getMeliConnectionByOrganizationId,
	getMeliOrder,
	getMeliShipment,
} from '@/lib/integrations/mercado-livre/api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type Params = Promise<{ id: string }>

type RecordValue = Record<string, unknown>

function asRecord(value: unknown): RecordValue | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return value as RecordValue
}

function text(value: unknown): string | null {
	if (value == null) return null
	const valueText = String(value).trim()
	return valueText || null
}

function nestedText(value: unknown): string | null {
	const record = asRecord(value)
	return text(record?.name) || text(record?.value_name) || text(record?.value)
}

export async function GET(_request: Request, { params }: { params: Params }) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { id: rawId } = await params
	const orderId = parseOptionalUuid(rawId)
	if (!orderId) {
		return NextResponse.json(
			{ ok: false, error: 'invalid_id' },
			{ status: 400 },
		)
	}

	const { data: orderRow, error } = await auth.supabase
		.from('sales_orders')
		.select(
			'id, ml_order_id, customer_id, customer_name, customer_document, customer_type',
		)
		.eq('organization_id', auth.organizationId)
		.eq('id', orderId)
		.maybeSingle()

	if (error) {
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}
	if (!orderRow) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}

	const mlOrderId = text(orderRow.ml_order_id)
	const customerId = text(orderRow.customer_id)
	const { data: savedCustomer } = customerId
		? await auth.supabase
				.from('customers')
				.select(
					'id, full_name, cpf, zip_code, address_full, city, state, neighborhood, street, street_number, street_complement',
				)
				.eq('organization_id', auth.organizationId)
				.eq('id', customerId)
				.maybeSingle()
		: { data: null }
	if (!mlOrderId) {
		return NextResponse.json(
			{ ok: false, error: 'not_meli_order' },
			{ status: 400 },
		)
	}

	const connection = await getMeliConnectionByOrganizationId(
		auth.supabase,
		auth.organizationId,
	)
	let order: RecordValue = {}
	if (connection) {
		try {
			order = await getMeliOrder(connection, mlOrderId, auth.supabase)
		} catch (requestError) {
			const message =
				requestError instanceof Error ? requestError.message : 'unknown_error'
			console.error('[meli buyer details]', message)
		}
	}

	const buyer = asRecord(order.buyer) ?? {}
	const billing = asRecord(buyer.billing_info) ?? {}
	const shipping = asRecord(order.shipping) ?? {}
	let receiver = asRecord(shipping.receiver_address) ?? {}
	if (
		connection &&
		!text(receiver.zip_code) &&
		!text(receiver.street_name) &&
		text(shipping.id)
	) {
		try {
			const shipment = await getMeliShipment(
				connection,
				String(shipping.id),
				auth.supabase,
			)
			receiver = asRecord(shipment.receiver_address) ?? receiver
		} catch (requestError) {
			const message =
				requestError instanceof Error ? requestError.message : 'unknown_error'
			console.error('[meli buyer shipment details]', message)
		}
	}
	const city = nestedText(receiver.city) || text(savedCustomer?.city)
	const state = nestedText(receiver.state) || text(savedCustomer?.state)
	const neighborhood =
		nestedText(receiver.neighborhood) || text(savedCustomer?.neighborhood)
	const street =
		text(receiver.street_name) ||
		text(receiver.address_line) ||
		text(savedCustomer?.street)
	const streetNumber =
		text(receiver.street_number) || text(savedCustomer?.street_number)
	const addressParts = [
		street && streetNumber
			? `${street}, ${streetNumber}`
			: street || streetNumber,
		text(receiver.floor) ||
			text(receiver.apartment) ||
			text(savedCustomer?.street_complement),
		neighborhood,
		[city, state].filter(Boolean).join(' - ') || null,
		text(receiver.comment),
	].filter((part): part is string => Boolean(part))

	const docType = (
		text(buyer.doc_type) ||
		text(billing.doc_type) ||
		''
	).toUpperCase()
	const rawDocument =
		text(buyer.doc_number) ||
		text(billing.doc_number) ||
		text(orderRow.customer_document)
	const documentDigits = rawDocument?.replace(/\D/g, '') || ''
	const cpf =
		docType.includes('CNPJ') || orderRow.customer_type === 'pj'
			? null
			: documentDigits.length === 11
				? documentDigits
				: rawDocument
	const receiverName = text(receiver.receiver_name)
	const fullName = [text(buyer.first_name), text(buyer.last_name)]
		.filter(Boolean)
		.join(' ')

	return NextResponse.json({
		ok: true,
		buyer: {
			id: text(buyer.id),
			customerId,
			name:
				fullName ||
				text(buyer.name) ||
				receiverName ||
				text(savedCustomer?.full_name) ||
				text(orderRow.customer_name),
			nickname: text(buyer.nickname),
			cpf: cpf || text(savedCustomer?.cpf),
			cep: text(receiver.zip_code) || text(savedCustomer?.zip_code),
			address: addressParts.join(', ') || text(savedCustomer?.address_full),
		},
	})
}
