import { describe, expect, it } from 'vitest'
import { getFaqPageJsonLd, getLocalBusinessJsonLd } from '@/lib/data/business'
import { geoLandingPages } from '@/lib/data/geo-landing-pages'
import { getLojaJsonLd } from '@/lib/data/hotsite-loja'
import { brands, services } from '@/lib/data/services'
import {
	GOOGLE_REVIEW_COUNT,
	googleAggregateRatingJsonLd,
	googleReviews,
	homeMetaDescription,
	SERVICE_WARRANTY_MONTHS,
	serviceWarranty,
} from '@/lib/data/site-facts'
import { buildLlmsTxt } from '@/lib/seo/llms-txt'
import { generateProgrammaticContent } from '@/lib/utils/programmatic-content'

function assertJsonLd (value: unknown) {
	const parsed = JSON.parse(JSON.stringify(value)) as {
		'@context': string
		'@type': string | string[]
		aggregateRating?: {
			'@type': string
			ratingValue: string
			ratingCount: number
			reviewCount: number
		}
	}
	expect(parsed['@context']).toBe('https://schema.org')
	expect(parsed['@type']).toBeTruthy()
	expect(parsed.aggregateRating?.['@type']).toBe('AggregateRating')
	expect(parsed.aggregateRating?.ratingValue).toBe('5.0')
	expect(parsed.aggregateRating?.ratingCount).toBe(419)
	expect(parsed.aggregateRating?.reviewCount).toBe(419)
	expect(JSON.stringify(parsed)).not.toContain('6 meses')
	return parsed
}

describe('fatos públicos do site', () => {
	it('centraliza garantia de 12 meses e a nota do Google', () => {
		expect(SERVICE_WARRANTY_MONTHS).toBe(12)
		expect(serviceWarranty.phrase).toBe('garantia de 12 meses')
		expect(serviceWarranty.duration).not.toContain('6 meses')
		expect(GOOGLE_REVIEW_COUNT).toBe(419)
		expect(googleReviews.homeLine).toBe('Nota 5,0 no Google · 419 avaliações')
		expect(googleAggregateRatingJsonLd()).toEqual({
			'@type': 'AggregateRating',
			ratingValue: '5.0',
			bestRating: 5,
			worstRating: 1,
			ratingCount: 419,
			reviewCount: 419,
		})
		expect(homeMetaDescription).toContain('garantia de 12 meses')
		expect(homeMetaDescription).not.toContain('6 meses')
	})

	it('publica AggregateRating válido no LocalBusiness e na loja', () => {
		assertJsonLd(getLocalBusinessJsonLd())
		assertJsonLd(getLojaJsonLd())
	})

	it('usa 12 meses em todas as FAQs programáticas e geo', () => {
		for (const service of services) {
			for (const brandSlug of service.brands) {
				const brand = brands[brandSlug]
				if (!brand) continue
				const excluded = service.excludedDeviceTypes?.[brandSlug] || []
				for (const deviceType of Object.values(brand.deviceTypes)) {
					if (excluded.includes(deviceType.slug)) continue
					const content = generateProgrammaticContent({ service, brand, deviceType })
					const blob = JSON.stringify(getFaqPageJsonLd(content.sections.faq))
					expect(blob).toContain('12 meses')
					expect(blob).not.toContain('6 meses')
					expect(blob).toContain('"@type":"FAQPage"')
				}
			}
		}

		for (const page of geoLandingPages) {
			const blob = JSON.stringify(getFaqPageJsonLd(page.faq))
			expect(blob).not.toContain('6 meses')
			expect(JSON.parse(blob)['@context']).toBe('https://schema.org')
		}
	})

	it('resume o negócio no llms.txt', () => {
		const text = buildLlmsTxt()
		expect(text.startsWith('# Conectize')).toBe(true)
		expect(text).toContain('especializada em iPhone')
		expect(text).toContain('Samsung, Xiaomi, Motorola, iPad, Apple Watch e MacBook')
		expect(text).toContain('Loja de acessórios')
		expect(text).toContain('R. Padre Rolim, 620, Santa Efigênia, Belo Horizonte-MG, 30130-094')
		expect(text).toContain('+55 31 98614-0889')
		expect(text).toContain('contato@conectize.com.br')
		expect(text).toContain('seg-sex 08:30-18:30, sáb 10-14')
		expect(text).toContain('garantia de 12 meses')
		expect(text).toContain('Coleta em domicílio')
		expect(text).toContain('Nota 5,0 no Google · 419 avaliações')
		expect(text).toContain('/loja')
		expect(text).not.toContain('6 meses')
		expect(text).not.toContain('—')
	})
})
