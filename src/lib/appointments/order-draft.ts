import { resolveOrderDiscountCents } from '@/lib/orders/order-discount-commission'
import { BOOKING_DISCOUNT_PERCENT } from './battery-prices'

export const BOOKING_ORDER_TITLE = 'Troca de bateria'

export const BOOKING_CUSTOMER_DESCRIPTION = 'Agendamento online de troca de bateria. Desconto de 5% do agendamento online.'

export type AppointmentVisit = {
	path: string
	search: string
	referrer: string
}

export type BatteryOrderProduct = {
	id: string
	name: string
	kind: 'service' | 'product'
	salePriceCents: number
	costPriceCents: number
}

export type BatteryOrderServiceLine = {
	kind: 'service' | 'product'
	description: string
	quantity: number
	unitValueCents: number
	unitCostCents: number
	valueCents: number
	costCents: number
	sourceProductId: string
	noCost: boolean
}

function oneLine (value: string, max: number) {
	return String(value || '')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max)
}

export function normalizeAppointmentVisit (input: Partial<AppointmentVisit> | null | undefined): AppointmentVisit {
	const pathRaw = oneLine(input?.path || '', 240)
	const path = pathRaw.startsWith('/') && !pathRaw.startsWith('//') && !pathRaw.includes('://')
		? (pathRaw.split('?')[0] || '/loja/bateria-iphone')
		: '/loja/bateria-iphone'
	let search = oneLine(input?.search || '', 800)
	if (!search.startsWith('?') || search.includes('://')) search = ''
	const referrerRaw = oneLine(input?.referrer || '', 500)
	const referrer = /^https?:\/\//i.test(referrerRaw) ? referrerRaw : ''
	return { path, search, referrer }
}

export function buildAppointmentInternalNote (visit: AppointmentVisit, extra = '') {
	const lines = [
		'Origem do cliente no agendamento online',
		`Rota: ${visit.path}`,
		`Query: ${visit.search || '(nenhuma)'}`,
		`Referrer: ${visit.referrer || 'acesso direto'}`,
	]
	const note = oneLine(extra, 300)
	if (note) lines.push(note)
	return lines.join('\n')
}

export function batteryOrderServices (product: BatteryOrderProduct | null) {
	if (!product?.id || !product.name.trim()) {
		return {
			items: [] as BatteryOrderServiceLine[],
			totalValueCents: 0,
			totalCostCents: 0,
			discountCents: 0,
		}
	}
	const kind = product.kind === 'service' ? 'service' : 'product'
	const quantity = 1
	const unitValueCents = Math.max(0, Math.round(product.salePriceCents) || 0)
	const unitCostCents = Math.max(0, Math.round(product.costPriceCents) || 0)
	const line: BatteryOrderServiceLine = {
		kind,
		description: product.name.trim().slice(0, 240),
		quantity,
		unitValueCents,
		unitCostCents,
		valueCents: unitValueCents * quantity,
		costCents: unitCostCents * quantity,
		sourceProductId: product.id,
		noCost: false,
	}
	return {
		items: [line],
		totalValueCents: line.valueCents,
		totalCostCents: line.costCents,
		discountCents: resolveOrderDiscountCents(line.valueCents, 'percent', 0, BOOKING_DISCOUNT_PERCENT),
	}
}
