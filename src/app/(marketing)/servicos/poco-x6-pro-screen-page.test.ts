import { describe, expect, it } from 'vitest'
import {
	POCO_X6_PRO_GLASS_SLUG,
	pocoX6ProScreenFaq,
	pocoX6ProScreenSeo,
} from './poco-x6-pro-screen-page'

describe('página de tela e vidro do POCO X6 Pro', () => {
	it('alinha title, h1 e description à troca de tela, sem perder o vidro', () => {
		expect(POCO_X6_PRO_GLASS_SLUG).toBe(
			'troca-de-vidro-da-tela-xiaomi-poco-x6-pro',
		)
		expect(pocoX6ProScreenSeo.title).toBe(
			'Troca de Tela POCO X6 Pro em BH | Conectize',
		)
		expect(pocoX6ProScreenSeo.h1).toBe(
			'Troca de Tela e Vidro do POCO X6 Pro em Belo Horizonte',
		)
		expect(pocoX6ProScreenSeo.description).toContain('POCO X6 Pro')
		expect(pocoX6ProScreenSeo.description).toContain('Belo Horizonte')
		expect(pocoX6ProScreenSeo.description).toContain('tela')
		expect(pocoX6ProScreenSeo.description).toContain('vidro')
		expect(pocoX6ProScreenSeo.description).not.toMatch(/R\$\s?\d/)
	})

	it('separa vidro e conjunto, sem preço inventado', () => {
		const answers = pocoX6ProScreenFaq
			.map((item) => `${item.q} ${item.a}`)
			.join(' ')
		expect(answers).toContain('conjunto')
		expect(answers).toContain('somente o vidro')
		expect(answers).toContain('Solicitar orçamento')
		expect(answers).toContain('6 meses')
		expect(answers).toContain('24 horas úteis')
		expect(answers).toContain('48 horas')
		expect(answers).not.toContain('12 meses')
		expect(answers).not.toMatch(/R\$\s?\d/)
		expect(answers).not.toMatch(/página geral|nesta rota|esta página/i)
	})
})
