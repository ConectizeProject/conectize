import { describe, expect, it } from 'vitest'
import {
	bookingCustomerCpfCandidates,
	buildBookingContactNotes,
	pickCustomerRowByCpf,
	publicBookingCanAttachToCustomer,
} from './service'

describe('cliente no agendamento público', () => {
	it('busca CPF com e sem máscara', () => {
		expect(bookingCustomerCpfCandidates('529.982.247-25')).toEqual([
			'52998224725',
			'529.982.247-25',
		])
		expect(bookingCustomerCpfCandidates('52998224725')).toEqual([
			'52998224725',
			'529.982.247-25',
		])
		expect(bookingCustomerCpfCandidates('123')).toEqual([])
	})

	it('prefere o cadastro com CPF só dígitos quando há duplicata de formato', () => {
		const picked = pickCustomerRowByCpf(
			[
				{ id: 'masked', cpf: '529.982.247-25' },
				{ id: 'digits', cpf: '52998224725' },
			],
			'52998224725',
		)
		expect(picked?.id).toBe('digits')
	})

	it('ainda encontra cadastro só com CPF mascarado', () => {
		const picked = pickCustomerRowByCpf(
			[{ id: 'masked', cpf: '529.982.247-25' }],
			'52998224725',
		)
		expect(picked?.id).toBe('masked')
	})

	it('registra na OS somente os dados de contato diferentes', () => {
		expect(buildBookingContactNotes(
			{
				full_name: 'Cliente Atual',
				email: 'cliente@empresa.com',
				mobile_phone: '31988887777',
				phone: '31988887777',
			},
			{
				fullName: 'Nome informado',
				email: 'novo@empresa.com',
				phone: '(31) 9 1111-2222',
			},
		)).toBe([
			'Informações de contato informadas no agendamento:',
			'Nome: Nome informado',
			'E-mail: novo@empresa.com',
			'Celular: (31) 9 1111-2222',
		].join('\n'))
	})

	it('só reutiliza cadastro existente quando o e-mail confere', () => {
		expect(publicBookingCanAttachToCustomer(
			{ email: 'Cliente@empresa.com' },
			'cliente@empresa.com',
		)).toBe(true)
		expect(publicBookingCanAttachToCustomer(
			{ email: 'cliente@empresa.com' },
			'atacante@evil.test',
		)).toBe(false)
		expect(publicBookingCanAttachToCustomer(
			{ email: '' },
			'atacante@evil.test',
		)).toBe(false)
		expect(publicBookingCanAttachToCustomer(
			{ email: null },
			'atacante@evil.test',
		)).toBe(false)
	})

	it('não cria observação quando os dados conferem', () => {
		expect(buildBookingContactNotes(
			{
				full_name: 'Cliente Atual',
				email: 'CLIENTE@empresa.com',
				mobile_phone: '31999998888',
			},
			{
				fullName: 'cliente atual',
				email: 'cliente@empresa.com',
				phone: '(31) 9 9999-8888',
			},
		)).toBe('')
	})
})
