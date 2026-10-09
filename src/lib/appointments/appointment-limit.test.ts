import { describe, expect, it } from 'vitest'
import { nextAppointmentDecision } from './service'

describe('limite de agendamentos simultâneos', () => {
	it('cria o primeiro sem confirmação', () => {
		expect(nextAppointmentDecision(0, false)).toBe('criar')
	})

	it('pede confirmação no segundo e no terceiro', () => {
		expect(nextAppointmentDecision(1, false)).toBe('ja_agendado')
		expect(nextAppointmentDecision(2, false)).toBe('ja_agendado')
		expect(nextAppointmentDecision(1, true)).toBe('criar')
		expect(nextAppointmentDecision(2, true)).toBe('criar')
	})

	it('bloqueia a partir do quarto', () => {
		expect(nextAppointmentDecision(3, false)).toBe('limite')
		expect(nextAppointmentDecision(3, true)).toBe('limite')
	})
})
