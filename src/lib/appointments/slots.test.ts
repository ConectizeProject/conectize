import { describe, expect, it } from 'vitest'
import {
	canCustomerChangeAppointment,
	formatSlotLabel,
	isBookableSlot,
	lastBookableDateKey,
	listSlotStarts,
} from './slots'

describe('horários de agendamento da loja', () => {
	it('abre 1 hora depois e fecha de 30 em 30 na segunda', () => {
		const slots = listSlotStarts('2026-10-12')
		expect(formatSlotLabel(slots[0])).toBe('09:30')
		expect(formatSlotLabel(slots[slots.length - 1])).toBe('18:00')
		expect(slots).toHaveLength(18)
	})

	it('no sábado começa às 11:00 e termina às 13:30', () => {
		const slots = listSlotStarts('2026-10-10')
		expect(formatSlotLabel(slots[0])).toBe('11:00')
		expect(formatSlotLabel(slots[slots.length - 1])).toBe('13:30')
		expect(slots).toHaveLength(6)
	})

	it('domingo não tem horário', () => {
		expect(listSlotStarts('2026-10-11')).toEqual([])
	})

	it('recusa horário fora da grade ou no passado', () => {
		const slots = listSlotStarts('2026-10-12')
		expect(isBookableSlot(slots[0], new Date('2026-10-12T11:00:00-03:00'))).toBe(false)
		expect(isBookableSlot(slots[0], new Date('2026-10-12T08:00:00-03:00'))).toBe(true)
		expect(isBookableSlot('2026-10-12T08:30:00-03:00', new Date('2026-10-01T00:00:00-03:00'))).toBe(false)
	})

	it('não abre horário depois de 15 dias', () => {
		const now = new Date('2026-10-08T12:00:00-03:00')
		expect(lastBookableDateKey(now)).toBe('2026-10-23')
		const inside = listSlotStarts('2026-10-23')[0]
		const outside = listSlotStarts('2026-10-24')[0]
		expect(isBookableSlot(inside, now)).toBe(true)
		expect(isBookableSlot(outside, now)).toBe(false)
	})

	it('cliente só altera com 1 hora de antecedência, em orçamento e sem revisão', () => {
		const starts = '2026-10-12T15:00:00.000Z'
		const now = new Date('2026-10-12T12:00:00.000Z')
		expect(canCustomerChangeAppointment(starts, null, 'orcamento', now)).toBe(true)
		expect(canCustomerChangeAppointment(starts, null, 'orcamento', new Date('2026-10-12T14:30:00.000Z'))).toBe(false)
		expect(canCustomerChangeAppointment(starts, '2026-10-12T10:00:00.000Z', 'orcamento', now)).toBe(false)
		expect(canCustomerChangeAppointment(starts, null, 'aprovado', now)).toBe(false)
	})
})
