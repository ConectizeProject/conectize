import { describe, expect, it } from 'vitest'
import {
	aggregateMeliFlexStatus,
	displayFieldsFromStoredRaw,
	extractMeliListingDisplayFields,
	flexStatusFromMeliTags,
	stockFromMeliItem,
	stockFromMeliLocations,
	sumNullableStock,
} from '@/lib/integrations/mercado-livre/listing-display'

describe('flexStatusFromMeliTags', () => {
	it('detects active, inactive and unavailable flex', () => {
		expect(flexStatusFromMeliTags(['self_service_in'])).toBe('active')
		expect(flexStatusFromMeliTags(['self_service_out'])).toBe('inactive')
		expect(flexStatusFromMeliTags(['self_service_available'])).toBe('inactive')
		expect(flexStatusFromMeliTags(['fulfillment'])).toBe('unavailable')
	})
})

describe('aggregateMeliFlexStatus', () => {
	it('aggregates variation flex states for parent icon', () => {
		expect(aggregateMeliFlexStatus(['active', 'active', 'active'])).toBe(
			'active',
		)
		expect(
			aggregateMeliFlexStatus(['inactive', 'unavailable', 'inactive']),
		).toBe('unavailable')
		expect(aggregateMeliFlexStatus(['active', 'inactive', 'unavailable'])).toBe(
			'mixed',
		)
	})
})

describe('stockFromMeliLocations', () => {
	it('reads full and deposito quantities', () => {
		expect(
			stockFromMeliLocations([
				{ type: 'meli_facility', quantity: 4 },
				{ type: 'selling_address', quantity: 7 },
			]),
		).toEqual({ stock_full: 4, stock_deposito: 7 })
	})
})

describe('stockFromMeliItem', () => {
	it('falls back to available_quantity by logistic type', () => {
		expect(
			stockFromMeliItem({
				available_quantity: 12,
				shipping: { logistic_type: 'fulfillment' },
			}),
		).toEqual({ stock_full: 12, stock_deposito: 0 })

		expect(
			stockFromMeliItem({
				available_quantity: 8,
				shipping: { logistic_type: 'cross_docking' },
			}),
		).toEqual({ stock_full: null, stock_deposito: 8 })
	})
})

describe('extractMeliListingDisplayFields', () => {
	it('extracts promo original price when higher than current price', () => {
		const fields = extractMeliListingDisplayFields({
			price: 89.9,
			original_price: 119.9,
			tags: ['self_service_in'],
			available_quantity: 3,
			shipping: { logistic_type: 'fulfillment' },
		})
		expect(fields).toMatchObject({
			flex_status: 'active',
			stock_full: 3,
			stock_deposito: 0,
			original_price_cents: 11990,
		})
	})
})

describe('displayFieldsFromStoredRaw', () => {
	it('reads persisted display fields from listing raw', () => {
		expect(
			displayFieldsFromStoredRaw({
				flex_status: 'inactive',
				stock_full: 2,
				stock_deposito: 5,
				original_price_cents: 1500,
			}),
		).toMatchObject({
			flex_status: 'inactive',
			stock_full: 2,
			stock_deposito: 5,
			original_price_cents: 1500,
		})
	})
})

describe('sumNullableStock', () => {
	it('sums only defined stock values', () => {
		expect(sumNullableStock([2, null, 3])).toBe(5)
		expect(sumNullableStock([null, undefined])).toBeNull()
	})
})
