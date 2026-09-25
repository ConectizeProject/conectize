import { describe, expect, it } from 'vitest'
import { brands } from '@/lib/data/services'
import { resolveBatteryModelLanding } from './battery-model-page'

function landingOrThrow(slug: string) {
	const landing = resolveBatteryModelLanding(slug)
	if (!landing) throw new Error(`landing ausente: ${slug}`)
	return landing
}

describe('landing comercial de troca de bateria', () => {
	it('mantém a página do iPhone 13 na intenção do modelo', () => {
		const landing = landingOrThrow('troca-de-bateria-apple-iphone-13')
		expect(landing.seo.title).toBe(
			'Troca de Bateria iPhone 13 em BH | Conectize',
		)
		expect(landing.seo.h1).toBe(
			'Troca de Bateria do iPhone 13 em Belo Horizonte',
		)
		expect(landing.seo.description).toContain('iPhone 13')
		expect(landing.seo.description).toContain('Belo Horizonte')
		expect(landing.seo.description).not.toMatch(/R\$\s?\d/)
		expect(landing.siblings.map((item) => item.label)).toEqual([
			'Troca de bateria iPhone 13 Pro Max',
			'Troca de bateria iPhone 13 Pro',
			'Troca de bateria iPhone 13 mini',
		])
	})

	it('responde preço, dados, prazo e garantia sem valor inventado', () => {
		const answers = landingOrThrow('troca-de-bateria-apple-iphone-13')
			.faq.map((item) => `${item.q} ${item.a}`)
			.join(' ')
		expect(answers).toContain('Solicitar orçamento')
		expect(answers).toContain('backup')
		expect(answers).toContain('24 horas úteis')
		expect(answers).toContain('12 meses')
		expect(answers).not.toMatch(/R\$\s?\d/)
		expect(answers).not.toMatch(/página geral|nesta rota|esta página/i)
	})

	it('aplica a mesma landing aos outros modelos', () => {
		const iphone14 = landingOrThrow('troca-de-bateria-apple-iphone-14')
		const galaxy = landingOrThrow('troca-de-bateria-samsung-galaxy-a54')
		const se = landingOrThrow('troca-de-bateria-apple-iphone-se-2022')

		expect(iphone14.seo.title).toBe(
			'Troca de Bateria iPhone 14 em BH | Conectize',
		)
		expect(iphone14.seo.h1).toBe(
			'Troca de Bateria do iPhone 14 em Belo Horizonte',
		)
		expect(iphone14.siblingsHeading).toBe(
			'Troca de bateria nos outros iPhone 14',
		)
		expect(iphone14.steps.join(' ')).toContain('tiras adesivas')
		expect(iphone14.seo.description).not.toMatch(/R\$\s?\d/)

		expect(galaxy.seo.h1).toBe(
			'Troca de Bateria do Galaxy A54 em Belo Horizonte',
		)
		expect(galaxy.hubLabel).toBe('Troca de bateria Samsung')
		expect(galaxy.steps.join(' ')).not.toContain('tiras adesivas')
		expect(galaxy.faq.map((item) => item.a).join(' ')).toContain('12 meses')
		expect(galaxy.seo.description).not.toMatch(/R\$\s?\d/)

		expect(se.name).toBe('iPhone SE 2022')
		expect(se.siblingsHeading).toBe('Troca de bateria nos outros iPhone SE')
	})

	it('deixa o hub e os outros serviços no template compartilhado', () => {
		expect(
			resolveBatteryModelLanding('troca-de-bateria-apple-iphone'),
		).toBeNull()
		expect(
			resolveBatteryModelLanding('troca-de-tela-apple-iphone-13'),
		).toBeNull()
	})

	it('cobre cada modelo de bateria do catálogo', () => {
		for (const brand of Object.values(brands)) {
			for (const deviceType of Object.values(brand.deviceTypes)) {
				for (const modelSlug of deviceType.models) {
					if (brand.deviceTypes[modelSlug]) continue
					const slug = `troca-de-bateria-${brand.slug}-${modelSlug}`
					const landing = landingOrThrow(slug)
					expect(landing.name.length).toBeGreaterThan(0)
					expect(landing.seo.description).toContain(landing.name)
					expect(landing.faq.some((item) => item.a.includes('12 meses'))).toBe(
						true,
					)
					expect(`${landing.intro} ${landing.seo.description}`).not.toMatch(
						/página geral|nesta rota|esta página/i,
					)
				}
			}
		}
	})
})
