import { describe, expect, it } from 'vitest'
import {
	bookingCustomerCpfCandidates,
	buildPublicBookingCustomerPatch,
	pickCustomerRowByCpf,
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

	it('não sobrescreve e-mail nem telefone já preenchidos', () => {
		expect(buildPublicBookingCustomerPatch(
			{
				email: 'cliente@empresa.com',
				mobile_phone: '31988887777',
				phone: '31988887777',
				referral_source: 'instagram',
			},
			{ email: 'atacante@evil.test', phone: '31911112222' },
		)).toEqual({})
	})

	it('preenche só campos vazios e a origem quando faltam', () => {
		expect(buildPublicBookingCustomerPatch(
			{
				email: null,
				mobile_phone: '',
				phone: '3133334444',
				referral_source: null,
			},
			{ email: 'novo@cliente.com', phone: '31999998888' },
		)).toEqual({
			email: 'novo@cliente.com',
			mobile_phone: '31999998888',
			referral_source: 'google',
		})
	})
})
