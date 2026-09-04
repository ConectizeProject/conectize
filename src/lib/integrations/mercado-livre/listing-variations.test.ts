import { describe, expect, it } from 'vitest'
import {
	extractMeliBarcode,
	extractMeliItemVariations,
	extractPickerLabel,
	groupMeliListings,
	type MeliListingCard,
	meliListingGroupMatchesQuery,
	meliListingMetadataFromRaw,
	sellerSkuFromStoredRaw,
	userProductIdFromMeliItem,
	variationLabelFromCombinations,
} from '@/lib/integrations/mercado-livre/listing-variations'

function listing(
	partial: Partial<MeliListingCard> &
		Pick<MeliListingCard, 'id' | 'ml_item_id'>,
): MeliListingCard {
	return {
		product_id: null,
		title: 'Cordinha',
		permalink: null,
		thumbnail_url: null,
		status: 'active',
		price_cents: 1990,
		original_price_cents: null,
		stock_full: null,
		stock_deposito: 1,
		flex_status: 'unavailable',
		flex_aggregate_status: 'unavailable',
		available_quantity: 1,
		meta: meliListingMetadataFromRaw(null),
		sold_quantity: 0,
		seller_sku: null,
		barcode: null,
		synced_at: '2026-08-31T12:00:00.000Z',
		user_product_id: null,
		family_id: null,
		family_name: null,
		picker_label: null,
		variations: [],
		...partial,
	}
}

describe('extractMeliBarcode', () => {
	it('reads GTIN from item attributes', () => {
		expect(
			extractMeliBarcode({
				attributes: [{ id: 'GTIN', value_name: '7891234567890' }],
			}),
		).toBe('7891234567890')
	})
})

describe('sellerSkuFromStoredRaw', () => {
	it('reads seller_custom_field and SELLER_SKU attribute', () => {
		expect(sellerSkuFromStoredRaw({ seller_custom_field: 'SKU-1' })).toBe(
			'SKU-1',
		)
		expect(
			sellerSkuFromStoredRaw({
				attributes: [{ id: 'SELLER_SKU', value_name: 'SKU-ATTR' }],
			}),
		).toBe('SKU-ATTR')
	})
})

describe('extractMeliItemVariations', () => {
	it('maps attribute combinations, sku and stock', () => {
		const variations = extractMeliItemVariations({
			id: 'MLB1',
			permalink: 'https://mlb.example/MLB1',
			secure_thumbnail: 'https://img.example/parent.jpg',
			status: 'active',
			pictures: [
				{
					id: 'pic-white',
					secure_url: 'https://img.example/white.jpg',
				},
			],
			variations: [
				{
					id: 11,
					price: 19.9,
					available_quantity: 5,
					sold_quantity: 2,
					seller_custom_field: 'Cordao Branco',
					picture_ids: ['pic-white'],
					attribute_combinations: [
						{ id: 'COLOR', name: 'Cor', value_name: 'Branco' },
					],
				},
				{
					id: 22,
					price: 21.5,
					available_quantity: 5,
					seller_sku: 'Cordao Preto',
					attribute_combinations: [
						{ id: 'COLOR', name: 'Cor', value_name: 'Preto' },
					],
				},
			],
		})

		expect(variations).toHaveLength(2)
		expect(variations[0]).toMatchObject({
			title: 'Branco',
			seller_sku: 'Cordao Branco',
			available_quantity: 5,
			thumbnail_url: 'https://img.example/white.jpg',
			price_cents: 1990,
		})
		expect(variations[1]).toMatchObject({
			title: 'Preto',
			seller_sku: 'Cordao Preto',
			thumbnail_url: 'https://img.example/parent.jpg',
			price_cents: 2150,
		})
	})
})

describe('variationLabelFromCombinations', () => {
	it('joins multiple attributes', () => {
		expect(
			variationLabelFromCombinations([
				{ value_name: 'Branco' },
				{ value_name: '128 GB' },
			]),
		).toBe('Branco · 128 GB')
	})
})

describe('groupMeliListings', () => {
	it('groups item variations under the parent listing', () => {
		const groups = groupMeliListings([
			listing({
				id: 'a',
				ml_item_id: 'MLB1',
				available_quantity: 10,
				variations: [
					{
						key: '1',
						title: 'Branco',
						ml_item_id: '11',
						seller_sku: 'branco',
						price_cents: 1990,
						available_quantity: 5,
						sold_quantity: 1,
						thumbnail_url: null,
						permalink: null,
						product_id: null,
						barcode: null,
						status: 'active',
					},
					{
						key: '2',
						title: 'Preto',
						ml_item_id: '22',
						seller_sku: 'preto',
						price_cents: 1990,
						available_quantity: 5,
						sold_quantity: 2,
						thumbnail_url: null,
						permalink: null,
						product_id: null,
						barcode: null,
						status: 'active',
					},
				],
			}),
		])

		expect(groups).toHaveLength(1)
		expect(groups[0].children.map((child) => child.title)).toEqual([
			'Branco',
			'Preto',
		])
		expect(groups[0].listing.available_quantity).toBe(10)
		expect(groups[0].listing.sold_quantity).toBe(3)
	})

	it('groups distinct items that share user_product_id', () => {
		const groups = groupMeliListings([
			listing({
				id: 'a',
				ml_item_id: 'MLB1',
				title: 'Cordinha',
				user_product_id: 'UP1',
				available_quantity: 5,
				synced_at: '2026-08-31T12:00:00.000Z',
			}),
			listing({
				id: 'b',
				ml_item_id: 'MLB2',
				title: 'Cordinha',
				user_product_id: 'UP1',
				available_quantity: 5,
				synced_at: '2026-08-30T12:00:00.000Z',
				variations: [
					{
						key: 'b1',
						title: 'Preto',
						ml_item_id: 'MLB2',
						seller_sku: 'preto',
						price_cents: 1990,
						available_quantity: 5,
						sold_quantity: 0,
						thumbnail_url: null,
						permalink: null,
						product_id: null,
						barcode: null,
						status: 'active',
					},
				],
			}),
		])

		expect(groups).toHaveLength(1)
		expect(groups[0].key).toBe('up:UP1')
		expect(groups[0].children).toHaveLength(2)
		expect(groups[0].listing.available_quantity).toBe(10)
	})

	it('groups sibling items by numeric family_id from Mercado Livre JSON', () => {
		const groups = groupMeliListings([
			listing({
				id: 'a',
				ml_item_id: 'MLB7565587886',
				title: 'Cordinha Branco',
				user_product_id: 'MLBU-A',
				family_id: String(1505865992075858),
				family_name: 'Cordinha',
				picker_label: 'Branco',
			}),
			listing({
				id: 'b',
				ml_item_id: 'MLB7565587888',
				title: 'Cordinha Preto',
				user_product_id: 'MLBU-B',
				family_id: '1505865992075858',
				family_name: 'Cordinha',
				picker_label: 'Preto',
			}),
		])

		expect(groups).toHaveLength(1)
		expect(groups[0].key).toBe('fam:1505865992075858')
	})

	it('groups sibling items by family_id even when user_product_id differs', () => {
		const groups = groupMeliListings([
			listing({
				id: 'a',
				ml_item_id: 'MLB7565587886',
				title: 'Cordinha Branco',
				user_product_id: 'MLBU-A',
				family_id: '1505865992075858',
				family_name: 'Cordinha Cordão Para Celular',
				picker_label: 'Branco',
				available_quantity: 5,
			}),
			listing({
				id: 'b',
				ml_item_id: 'MLB7565587888',
				title: 'Cordinha Preto',
				user_product_id: 'MLBU-B',
				family_id: '1505865992075858',
				family_name: 'Cordinha Cordão Para Celular',
				picker_label: 'Preto',
				available_quantity: 5,
			}),
		])

		expect(groups).toHaveLength(1)
		expect(groups[0].key).toBe('fam:1505865992075858')
		expect(groups[0].listing.ml_item_id).toBe('1505865992075858')
		expect(groups[0].listing.title).toBe('Cordinha Cordão Para Celular')
		expect(groups[0].children.map((child) => child.title)).toEqual([
			'Branco',
			'Preto',
		])
		expect(groups[0].listing.available_quantity).toBe(10)
	})

	it('keeps a listing without variations as a singleton', () => {
		const groups = groupMeliListings([
			listing({ id: 'a', ml_item_id: 'MLB1', variations: [] }),
		])
		expect(groups).toHaveLength(1)
		expect(groups[0].children).toEqual([])
	})
})

describe('meliListingGroupMatchesQuery', () => {
	it('matches variation sku even if parent title differs', () => {
		const [group] = groupMeliListings([
			listing({
				id: 'a',
				ml_item_id: 'MLB1',
				title: 'Cordinha',
				variations: [
					{
						key: '1',
						title: 'Branco',
						ml_item_id: '11',
						seller_sku: 'Cordao Basic Branco',
						price_cents: 1990,
						available_quantity: 5,
						sold_quantity: 0,
						thumbnail_url: null,
						permalink: null,
						product_id: null,
						barcode: null,
						status: 'active',
					},
					{
						key: '2',
						title: 'Preto',
						ml_item_id: '22',
						seller_sku: 'preto',
						price_cents: 1990,
						available_quantity: 5,
						sold_quantity: 0,
						thumbnail_url: null,
						permalink: null,
						product_id: null,
						barcode: null,
						status: 'active',
					},
				],
			}),
		])
		expect(meliListingGroupMatchesQuery(group, 'basic branco')).toBe(true)
		expect(meliListingGroupMatchesQuery(group, 'inexistente')).toBe(false)
	})
})

describe('userProductIdFromMeliItem', () => {
	it('reads only user_product_id', () => {
		expect(
			userProductIdFromMeliItem({
				user_product_id: ' MLBU1 ',
				family_id: 'FAM',
			}),
		).toBe('MLBU1')
	})
})

describe('extractPickerLabel', () => {
	it('prefers COLOR attribute', () => {
		expect(
			extractPickerLabel({
				title: 'Cordinha Cordão Para Celular Branco',
				family_name: 'Cordinha Cordão Para Celular',
				attributes: [
					{ id: 'COLOR', value_name: 'Branco' },
					{ id: 'BRAND', value_name: 'Generico' },
				],
			}),
		).toBe('Branco')
	})

	it('falls back to the title suffix after family_name', () => {
		expect(
			extractPickerLabel({
				title: 'Cordinha Cordão Para Celular - Preto',
				family_name: 'Cordinha Cordão Para Celular',
			}),
		).toBe('Preto')
	})
})
