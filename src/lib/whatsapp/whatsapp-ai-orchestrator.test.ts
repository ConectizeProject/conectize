import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	loadProductContext,
	parseDraftLine,
	stripDraftLine,
} from '@/lib/whatsapp/whatsapp-ai-orchestrator'

type ProductRow = {
	name: string
	kind: string
	sale_price_cents: number | null
	organization_id: string
}

function createProductsClient(rows: ProductRow[]) {
	const queries: Array<{ table: string; filters: Record<string, unknown> }> = []
	const supabase = {
		from(table: string) {
			const filters: Record<string, unknown> = {}
			queries.push({ table, filters })
			const chain = {
				select() {
					return chain
				},
				eq(column: string, value: unknown) {
					filters[column] = value
					return chain
				},
				order() {
					return chain
				},
				limit() {
					return chain
				},
				or() {
					return chain
				},
				then(
					onFulfilled: (value: { data: ProductRow[]; error: null }) => unknown,
					onRejected?: (reason: unknown) => unknown,
				) {
					const filtered = rows.filter((row) => {
						return Object.entries(filters).every(([column, value]) => {
							return row[column as keyof ProductRow] === value
						})
					})
					return Promise.resolve({ data: filtered, error: null }).then(
						onFulfilled,
						onRejected,
					)
				},
			}
			return chain
		},
	}
	return { supabase: supabase as unknown as SupabaseClient, queries }
}

describe('loadProductContext', () => {
	it('nao consulta produtos sem organization_id', async () => {
		const { supabase, queries } = createProductsClient([
			{
				name: 'Pelicula org B',
				kind: 'product',
				sale_price_cents: 5000,
				organization_id: 'org-b',
			},
		])

		const text = await loadProductContext(supabase, 'pelicula', '')

		expect(text).toBe('')
		expect(queries).toEqual([])
	})

	it('filtra o catalogo pela organization_id e ignora outras orgs', async () => {
		const { supabase, queries } = createProductsClient([
			{
				name: 'Pelicula org A',
				kind: 'product',
				sale_price_cents: 1990,
				organization_id: 'org-a',
			},
			{
				name: 'Pelicula org B',
				kind: 'product',
				sale_price_cents: 99900,
				organization_id: 'org-b',
			},
		])

		const text = await loadProductContext(supabase, 'pelicula', 'org-a')

		expect(text).toContain('Pelicula org A')
		expect(text).toContain('R$')
		expect(text).not.toContain('Pelicula org B')
		expect(queries[0]?.table).toBe('products')
		expect(queries[0]?.filters.organization_id).toBe('org-a')
	})
})

describe('parseDraftLine / stripDraftLine', () => {
	it('extrai DRAFT_OS_JSON e remove a linha da resposta', () => {
		const raw =
			'Ok, registrei.\nDRAFT_OS_JSON:{"full_name":"Ana","cpf":"","device_description":"iPhone","issue_description":""}'
		expect(parseDraftLine(raw)).toEqual({
			full_name: 'Ana',
			cpf: '',
			device_description: 'iPhone',
			issue_description: '',
		})
		expect(stripDraftLine(raw)).toBe('Ok, registrei.')
	})
})
