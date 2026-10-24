import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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

	it('registra booking_error no parâmetro error, sem conversão do Ads', () => {
		vi.stubGlobal('window', {
			gtag (...args: unknown[]) {
				events.push(args)
			},
			location: { pathname: '/loja/bateria-iphone' },
		})

		trackBookingFunnel('booking_error', { error: 'http_500_json', model: 'iPhone 13' })
		trackBookingFunnel('submit_booking', { model: 'iPhone 13', date: '2026-10-12', slot: '14:30' })

		expect(events).toHaveLength(2)
		expect(events[0]).toEqual([
			'event',
			'booking_error',
			{
				event_category: 'agendamento',
				event_label: 'http_500_json',
				page_path: '/loja/bateria-iphone',
				booking_model: 'iPhone 13',
				booking_date: undefined,
				booking_slot: undefined,
				error: 'http_500_json',
			},
		])
		expect(events[1]?.[1]).toBe('submit_booking')
		expect(events.some((item) => item[1] === 'conversion')).toBe(false)
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
	})
})
