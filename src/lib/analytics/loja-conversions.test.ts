import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackAgendamentoConcluido } from './loja-conversions'

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
