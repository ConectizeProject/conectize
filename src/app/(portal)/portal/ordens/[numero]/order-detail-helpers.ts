import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { toDateTimeLocalInBrazil } from '@/lib/utils/previsao-ordem'
import type { ServiceOrderDetail } from './service-order-detail-types'

export function getCustomerFromOrder (order: { customers?: unknown } | null) {
	const customer = order?.customers
	if (Array.isArray(customer)) return customer[0] || null
	return customer || null
}

export function getDeviceModelFromOrder (order: { device_models?: unknown } | null) {
	const deviceModel = order?.device_models
	if (Array.isArray(deviceModel)) return deviceModel[0] || null
	return deviceModel || null
}

export function parseOrderPaymentMethods (
  order: Record<string, unknown> | ServiceOrderDetail,
): Array<{
	payment_method_id: string
	installments?: number
	value_cents?: number | null
}> {
	let pm = order?.payment_methods
	if (typeof pm === 'string') {
		try {
			pm = JSON.parse(pm)
		} catch {
			pm = null
		}
	}
	if (Array.isArray(pm) && pm.length > 0) {
		return pm
			.map((e: { payment_method_id?: unknown; installments?: unknown; value_cents?: unknown }) => {
				const id = parseOptionalUuid(e?.payment_method_id)
				if (!id) return null
				return {
					payment_method_id: id,
					installments:
						e.installments != null ? Number(e.installments) : undefined,
					value_cents:
						e.value_cents != null
							? Math.max(0, Number(e.value_cents) || 0)
							: null,
				}
			})
			.filter(Boolean) as Array<{
			payment_method_id: string
			installments?: number
			value_cents?: number | null
		}>
	}
	return []
}

export function formatDateTimeLocal (value: string | null | undefined) {
	if (!value) return ''
	const dt = new Date(String(value))
	if (Number.isNaN(dt.getTime())) return ''
	return toDateTimeLocalInBrazil(dt)
}
