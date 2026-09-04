import { describe, expect, it } from 'vitest'
import { maskImeiForDisplay } from './mask-imei'

describe('maskImeiForDisplay', () => {
	it('mascara IMEI com 3 primeiros e 3 últimos', () => {
		expect(maskImeiForDisplay('356938035643809')).toBe('356***809')
	})

	it('ignora espaços e caracteres não numéricos quando há dígitos suficientes', () => {
		expect(maskImeiForDisplay('356 93803 5643809')).toBe('356***809')
	})

	it('retorna null para vazio', () => {
		expect(maskImeiForDisplay(null)).toBe(null)
		expect(maskImeiForDisplay('')).toBe(null)
		expect(maskImeiForDisplay('   ')).toBe(null)
	})

	it('retorna *** quando o valor é curto demais', () => {
		expect(maskImeiForDisplay('123456')).toBe('***')
	})
})
