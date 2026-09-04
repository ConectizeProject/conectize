import { describe, expect, it } from 'vitest'
import { meliListingEditUrl } from './listing-urls'

describe('meliListingEditUrl', () => {
	it('builds the seller edit URL for MLB item ids', () => {
		expect(meliListingEditUrl('MLB7565587886')).toBe(
			'https://www.mercadolivre.com.br/anuncios/MLB7565587886/modificar/bomni',
		)
	})

	it('ignores family ids and other non-item codes', () => {
		expect(meliListingEditUrl('1505865992075858')).toBeNull()
		expect(meliListingEditUrl(null)).toBeNull()
	})
})
