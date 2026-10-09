import { describe, expect, it } from 'vitest'
import { discountedPriceCents, mapBatteryPrices } from './battery-prices'

const products = [
	{ name: 'Bateria iPhone', salePriceCents: 0 },
	{ name: 'Bateria iPhone Modelo:11', salePriceCents: 35100 },
	{ name: 'Bateria iPhone Modelo:11 Pro', salePriceCents: 39000 },
	{ name: 'Bateria iPhone Modelo:11 Pro Max', salePriceCents: 46800 },
	{ name: 'Bateria iPhone Modelo:12 ou 12 Pro', salePriceCents: 39000 },
	{ name: 'Bateria iPhone Modelo:12 Pro Max', salePriceCents: 39000 },
	{ name: 'Bateria iPhone Modelo:14 Plus Plus:Bateria iPhone', salePriceCents: 50700 },
	{ name: 'Bateria iPhone Modelo:16 Pro', salePriceCents: 0 },
]

describe('preço da bateria cadastrada', () => {
	it('casa o modelo do iPhone com o produto e aplica 5%', () => {
		const prices = mapBatteryPrices(products)
		expect(prices['iPhone 11']).toBe(35100)
		expect(prices['iPhone 11 Pro']).toBe(39000)
		expect(prices['iPhone 11 Pro Max']).toBe(46800)
		expect(prices['iPhone 12']).toBe(39000)
		expect(prices['iPhone 12 Pro']).toBe(39000)
		expect(prices['iPhone 14 Plus']).toBe(50700)
		expect(prices['iPhone 16 Pro']).toBeUndefined()
		expect(prices['iPhone 17']).toBeUndefined()
		expect(discountedPriceCents(35100)).toBe(33345)
	})
})
