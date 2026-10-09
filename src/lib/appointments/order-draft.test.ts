import { describe, expect, it } from 'vitest'
import {
	batteryOrderServices,
	BOOKING_CUSTOMER_DESCRIPTION,
	buildAppointmentInternalNote,
	normalizeAppointmentVisit,
} from './order-draft'

describe('rascunho da OS de agendamento', () => {
	it('guarda rota, query e referrer na descrição interna', () => {
		const visit = normalizeAppointmentVisit({
			path: '/loja/bateria-iphone?utm_source=google',
			search: '?utm_source=google&gclid=abc',
			referrer: 'https://www.google.com/search?q=bateria',
		})
		expect(visit.path).toBe('/loja/bateria-iphone')
		expect(buildAppointmentInternalNote(visit)).toBe([
			'Origem do cliente no agendamento online',
			'Rota: /loja/bateria-iphone',
			'Query: ?utm_source=google&gclid=abc',
			'Referrer: https://www.google.com/search?q=bateria',
		].join('\n'))
	})

	it('descarta origem inválida e inclui a bateria com 5%', () => {
		const visit = normalizeAppointmentVisit({
			path: 'https://evil.example',
			search: 'utm_source=google',
			referrer: 'javascript:alert(1)',
		})
		expect(visit).toEqual({
			path: '/loja/bateria-iphone',
			search: '',
			referrer: '',
		})
		expect(BOOKING_CUSTOMER_DESCRIPTION).toBe('Agendamento online de troca de bateria. Desconto de 5% do agendamento online.')
		const services = batteryOrderServices({
			id: '11111111-1111-4111-8111-111111111111',
			name: 'Bateria iPhone Modelo:11',
			kind: 'product',
			salePriceCents: 35100,
			costPriceCents: 12000,
		})
		expect(services.items[0]?.description).toBe('Bateria iPhone Modelo:11')
		expect(services.items[0]?.sourceProductId).toBe('11111111-1111-4111-8111-111111111111')
		expect(services.totalValueCents).toBe(35100)
		expect(services.discountCents).toBe(1755)
	})
})
