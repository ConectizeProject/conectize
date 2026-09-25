import { describe, expect, it } from 'vitest'
import {
	iphone13BatteryFaq,
	iphone13BatterySeo,
} from './iphone-13-battery-page'

describe('página de troca de bateria do iPhone 13', () => {
	it('mantém title, h1 e description na intenção do modelo', () => {
		expect(iphone13BatterySeo.title).toBe(
			'Troca de Bateria iPhone 13 em BH | Conectize',
		)
		expect(iphone13BatterySeo.h1).toBe(
			'Troca de Bateria do iPhone 13 em Belo Horizonte',
		)
		expect(iphone13BatterySeo.description).toContain('iPhone 13')
		expect(iphone13BatterySeo.description).toContain('Belo Horizonte')
		expect(iphone13BatterySeo.description).not.toMatch(/R\$\s?\d/)
	})

	it('responde preço, dados, prazo e garantia sem valor inventado', () => {
		const answers = iphone13BatteryFaq
			.map((item) => `${item.q} ${item.a}`)
			.join(' ')
		expect(answers).toContain('Solicitar orçamento')
		expect(answers).toContain('backup')
		expect(answers).toContain('24 horas úteis')
		expect(answers).toContain('12 meses')
		expect(answers).not.toMatch(/R\$\s?\d/)
	})
})
