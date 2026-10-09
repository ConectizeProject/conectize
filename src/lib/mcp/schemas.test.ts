import { describe, expect, it } from 'vitest'
import { applyMcpProductUpdate } from './products'
import {
	buildCustomerPatch,
	buildProductPatch,
	parseOrderStatusInput,
} from './schemas'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'

describe('patches do MCP', () => {
	it('recusa status inválido', () => {
		const result = parseOrderStatusInput({ numero: '12', status: 'entregue' })
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error).toBe('invalid_status')
	})

	it('recusa CPF no patch de cliente', () => {
		const result = buildCustomerPatch({
			id: CUSTOMER_ID,
			cpf: '12345678901',
			phone: '31999999999',
		})
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error).toBe('document_locked')
	})

	it('recusa custo, fiscal e estoque no produto', () => {
		const cost = buildProductPatch({ id: PRODUCT_ID, costPriceCents: 100 })
		const stock = buildProductPatch({ id: PRODUCT_ID, stock: 3 })
		const ncm = buildProductPatch({ id: PRODUCT_ID, ncm: '85171231' })
		expect(cost.ok).toBe(false)
		expect(stock.ok).toBe(false)
		expect(ncm.ok).toBe(false)
		if (!cost.ok) expect(cost.error).toBe('field_forbidden')
	})

	it('recusa produto de outra organização sem gravar', async () => {
		const saves: string[] = []
		const result = await applyMcpProductUpdate(
			{
				loadById: async () => ({ id: PRODUCT_ID, organization_id: 'org-b' }),
				save: async () => {
					saves.push('save')
					return 'updated'
				},
			},
			'org-a',
			{ id: PRODUCT_ID, name: 'Tela' },
		)

		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error).toBe('wrong_organization')
		expect(saves).toEqual([])
	})
})
