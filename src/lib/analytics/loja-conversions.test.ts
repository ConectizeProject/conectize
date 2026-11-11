import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	bookingErrorReason,
	sanitizeBookingError,
	trackAgendamentoConcluido,
	trackBookingFunnel,
	trackWhatsAppClick,
} from './loja-conversions'

describe('sanitizeBookingError', () => {
	it('mantém códigos conhecidos e remove dados pessoais', () => {
		expect(sanitizeBookingError('dados_invalidos')).toBe('dados_invalidos')
		expect(sanitizeBookingError('http_500_json')).toBe('http_500_json')
		expect(sanitizeBookingError(new TypeError('Failed to fetch'))).toBe('failed_to_fetch')
		expect(sanitizeBookingError('Falha para maria@email.com CPF 123.456.789-09')).toBe(
			'falha_para_redacted_cpf_redacted',
		)
		expect(sanitizeBookingError('')).toBe('desconhecido')
	})
})

describe('bookingErrorReason', () => {
	it('mapeia motivos estáveis sem dados pessoais', () => {
		expect(bookingErrorReason('horario_indisponivel')).toBe('horario_indisponivel')
		expect(bookingErrorReason('dados_invalidos')).toBe('validacao_servidor')
		expect(bookingErrorReason('Failed to fetch')).toBe('timeout')
		expect(bookingErrorReason('config', 500)).toBe('falha_api')
		expect(bookingErrorReason('http_500_json')).toBe('falha_api')
	})
})

describe('trackAgendamentoConcluido', () => {
	const events: unknown[][] = []

	afterEach(() => {
		events.length = 0
		vi.unstubAllGlobals()
	})

	it('envia modelo, data e horário uma vez, sem dados pessoais', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
			location: { pathname: '/loja/bateria-iphone' },
		})

		const detail = { modelo: 'iPhone 13', dataAgendada: '2026-10-12', horario: '14:30' }
		trackAgendamentoConcluido(detail)
		trackAgendamentoConcluido(detail)

		expect(events).toEqual([[
			'event',
			'agendamento_concluido',
			{
				modelo: 'iPhone 13',
				data_agendada: '2026-10-12',
				horario: '14:30',
				page_path: '/loja/bateria-iphone',
			},
		]])
		const payload = events[0]?.[2] as Record<string, string>
		expect(payload).not.toHaveProperty('nome')
		expect(payload).not.toHaveProperty('cpf')
		expect(payload).not.toHaveProperty('email')
		expect(payload).not.toHaveProperty('telefone')
	})
})

describe('trackBookingFunnel', () => {
	const events: unknown[][] = []

	afterEach(() => {
		events.length = 0
		vi.unstubAllGlobals()
	})

	it('registra booking_error com error_reason e error_status, sem conversão do Ads', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
			location: { pathname: '/loja/bateria-iphone' },
		})

		trackBookingFunnel('booking_error', {
			error: 'http_500_json',
			errorStatus: 500,
			model: 'iPhone 13',
		})
		trackBookingFunnel('submit_booking', { model: 'iPhone 13', date: '2026-10-12', slot: '14:30' })

		expect(events).toHaveLength(2)
		expect(events[0]).toEqual([
			'event',
			'booking_error',
			{
				event_category: 'agendamento',
				event_label: 'falha_api',
				page_path: '/loja/bateria-iphone',
				booking_model: 'iPhone 13',
				booking_date: undefined,
				booking_slot: undefined,
				error: 'http_500_json',
				error_reason: 'falha_api',
				error_status: 500,
			},
		])
		expect(events[1]?.[1]).toBe('submit_booking')
		expect(events.some((item) => item[1] === 'conversion')).toBe(false)
		expect(events[0]?.[2]).not.toHaveProperty('cta_location')
	})

	it('envia form_view, form_start e form_field_error sem valor digitado', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
			location: { pathname: '/loja/bateria-iphone' },
		})

		trackBookingFunnel('form_view', { model: 'iPhone 13', date: '2026-10-12' })
		trackBookingFunnel('form_start', { model: 'iPhone 13', date: '2026-10-12' })
		trackBookingFunnel('form_field_error', {
			model: 'iPhone 13',
			date: '2026-10-12',
			errorField: 'cpf',
			errorType: 'invalido',
		})

		expect(events[0]?.[1]).toBe('form_view')
		expect(events[1]?.[1]).toBe('form_start')
		expect(events[2]).toEqual([
			'event',
			'form_field_error',
			{
				event_category: 'agendamento',
				event_label: 'cpf',
				page_path: '/loja/bateria-iphone',
				booking_model: 'iPhone 13',
				booking_date: '2026-10-12',
				booking_slot: undefined,
				error: undefined,
				error_field: 'cpf',
				error_type: 'invalido',
			},
		])
		const payload = events[2]?.[2] as Record<string, unknown>
		expect(payload).not.toHaveProperty('nome')
		expect(payload).not.toHaveProperty('cpf')
		expect(payload).not.toHaveProperty('email')
		expect(payload).not.toHaveProperty('telefone')
		expect(payload).not.toHaveProperty('value')
	})

	it('acrescenta cta_location e o modelo no start_booking', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
			location: { pathname: '/loja/bateria-iphone' },
		})

		trackBookingFunnel('start_booking', { ctaLocation: 'modelos', model: 'iPhone 13' })

		expect(events).toEqual([[
			'event',
			'start_booking',
			{
				event_category: 'agendamento',
				event_label: 'iPhone 13',
				page_path: '/loja/bateria-iphone',
				booking_model: 'iPhone 13',
				booking_date: undefined,
				booking_slot: undefined,
				error: undefined,
				cta_location: 'modelos',
			},
		]])
	})
})

describe('trackWhatsAppClick', () => {
	const events: unknown[][] = []

	afterEach(() => {
		events.length = 0
		vi.unstubAllGlobals()
	})

	it('dispara só whatsapp_click com page_path e link_url', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
		})

		trackWhatsAppClick({
			page_path: '/loja/bateria-iphone',
			link_url: 'https://wa.me/5531986140889?text=Oi',
		})

		expect(events).toEqual([[
			'event',
			'whatsapp_click',
			{
				page_path: '/loja/bateria-iphone',
				link_url: 'https://wa.me/5531986140889?text=Oi',
			},
		]])
		expect(events.some((item) => item[1] === 'clique_whatsapp')).toBe(false)
		expect(events.some((item) => item[1] === 'conversion_event_outbound_click')).toBe(false)
	})
})
