import { describe, expect, it } from 'vitest'
import {
	aggregateMeliListingMetadata,
	countMeliPromotions,
	extractMeliDimensionsLabel,
	extractMeliListingMetadata,
	extractMeliTechnicalSpecs,
	extractMeliWholesaleTiers,
	formatMeliRelativeDate,
} from '@/lib/integrations/mercado-livre/listing-metadata'

describe('extractMeliDimensionsLabel', () => {
	it('joins package dimensions and weight', () => {
		expect(
			extractMeliDimensionsLabel({
				attributes: [
					{ id: 'PACKAGE_LENGTH', value_name: '22 cm' },
					{ id: 'PACKAGE_WIDTH', value_name: '13 cm' },
					{ id: 'PACKAGE_HEIGHT', value_name: '3 cm' },
					{ id: 'PACKAGE_WEIGHT', value_name: '100 g' },
				],
			}),
		).toBe('22 cm x 13 cm x 3 cm · 100 g')
	})
})

describe('extractMeliWholesaleTiers', () => {
	it('reads quantity tiers from prices payload', () => {
		expect(
			extractMeliWholesaleTiers({
				prices: [
					{
						type: 'standard',
						amount: 72.28,
						conditions: { min_purchase_unit: 2 },
					},
					{
						type: 'standard',
						amount: 65.5,
						conditions: { min_purchase_unit: 5 },
					},
				],
			}),
		).toEqual([
			{ min_quantity: 2, price_cents: 7228 },
			{ min_quantity: 5, price_cents: 6550 },
		])
	})
})

describe('countMeliPromotions', () => {
	it('counts promotion prices', () => {
		expect(
			countMeliPromotions({
				prices: [
					{ type: 'standard', amount: 100 },
					{ type: 'promotion', amount: 80 },
					{ type: 'promotion', amount: 75 },
				],
			}),
		).toBe(2)
	})
})

describe('extractMeliListingMetadata', () => {
	it('maps dates, specs and description', () => {
		const meta = extractMeliListingMetadata(
			{
				date_created: '2026-08-28T10:00:00.000Z',
				last_updated: '2026-08-31T10:00:00.000Z',
				attributes: [
					{ id: 'MATERIAL', name: 'Material', value_name: 'Couro' },
					{ id: 'PACKAGE_LENGTH', value_name: '20 cm' },
				],
				pictures: [{}, {}, {}],
			},
			{
				descriptionPayload: { plain_text: 'Descrição do produto.' },
				pricesPayload: {
					prices: [{ type: 'promotion', amount: 70 }],
				},
			},
		)

		expect(meta.date_created).toBe('2026-08-28T10:00:00.000Z')
		expect(meta.description_plain).toBe('Descrição do produto.')
		expect(meta.promotions_count).toBe(1)
		expect(meta.pictures_count).toBe(3)
		expect(meta.technical_specs[0]).toEqual({
			name: 'Material',
			value: 'Couro',
		})
	})
})

describe('aggregateMeliListingMetadata', () => {
	it('sums promotions and picks oldest/newest dates', () => {
		const aggregated = aggregateMeliListingMetadata([
			extractMeliListingMetadata({
				date_created: '2026-08-20T10:00:00.000Z',
				last_updated: '2026-08-25T10:00:00.000Z',
				promotions_count: 1,
			}),
			extractMeliListingMetadata({
				date_created: '2026-08-28T10:00:00.000Z',
				last_updated: '2026-08-31T10:00:00.000Z',
				promotions_count: 2,
			}),
		])
		expect(aggregated.promotions_count).toBe(3)
		expect(aggregated.date_created).toBe('2026-08-20T10:00:00.000Z')
		expect(aggregated.last_updated).toBe('2026-08-31T10:00:00.000Z')
	})
})

describe('formatMeliRelativeDate', () => {
	it('formats recent dates in portuguese', () => {
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
		expect(formatMeliRelativeDate(threeDaysAgo)).toBe('Há 3 dias')
	})
})

describe('extractMeliTechnicalSpecs', () => {
	it('skips sku and dimension attributes', () => {
		const specs = extractMeliTechnicalSpecs({
			attributes: [
				{ id: 'SELLER_SKU', name: 'SKU', value_name: 'ABC' },
				{ id: 'PACKAGE_LENGTH', name: 'Comp.', value_name: '10 cm' },
				{ id: 'MATERIAL', name: 'Material', value_name: 'Silicone' },
			],
		})
		expect(specs).toEqual([{ name: 'Material', value: 'Silicone' }])
	})
})
