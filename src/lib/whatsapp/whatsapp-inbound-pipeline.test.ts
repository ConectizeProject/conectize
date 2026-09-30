import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getChatgptForWhatsapp } from '@/lib/whatsapp/whatsapp-inbound-pipeline'

type HubRow = {
	api_key: string
	metadata: { model?: string } | null
	platform_id: string
	organization_id: string
}

function createHubClient(rows: HubRow[]) {
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
				not() {
					return chain
				},
				maybeSingle() {
					const match = rows.find((row) => {
						if (filters.platform_id && row.platform_id !== filters.platform_id) {
							return false
						}
						if (
							filters.organization_id &&
							row.organization_id !== filters.organization_id
						) {
							return false
						}
						return Boolean(row.api_key)
					})
					return Promise.resolve({ data: match ?? null })
				},
			}
			return chain
		},
	}
	return { supabase: supabase as unknown as SupabaseClient, queries }
}

describe('getChatgptForWhatsapp', () => {
	const previousKey = process.env.OPENAI_API_KEY

	afterEach(() => {
		if (previousKey == null) delete process.env.OPENAI_API_KEY
		else process.env.OPENAI_API_KEY = previousKey
	})

	it('nao consulta hub sem organization_id e nao usa chave de outro tenant', async () => {
		delete process.env.OPENAI_API_KEY
		const { supabase, queries } = createHubClient([
			{
				api_key: 'sk-other-org',
				metadata: { model: 'gpt-4o' },
				platform_id: 'chatgpt',
				organization_id: 'org-b',
			},
		])

		const result = await getChatgptForWhatsapp(supabase, '')

		expect(result).toBeNull()
		expect(queries).toEqual([])
	})

	it('filtra a conexao ChatGPT pela organization_id', async () => {
		delete process.env.OPENAI_API_KEY
		const { supabase, queries } = createHubClient([
			{
				api_key: 'sk-org-a',
				metadata: { model: 'gpt-5-mini' },
				platform_id: 'chatgpt',
				organization_id: 'org-a',
			},
			{
				api_key: 'sk-org-b',
				metadata: { model: 'gpt-4o' },
				platform_id: 'chatgpt',
				organization_id: 'org-b',
			},
		])

		const result = await getChatgptForWhatsapp(supabase, 'org-a')

		expect(result).toEqual({ apiKey: 'sk-org-a', model: 'gpt-5-mini' })
		expect(queries[0]?.table).toBe('hub_connections')
		expect(queries[0]?.filters).toMatchObject({
			platform_id: 'chatgpt',
			organization_id: 'org-a',
		})
	})

	it('nao reutiliza a chave de outra organizacao quando a atual nao tem ChatGPT', async () => {
		delete process.env.OPENAI_API_KEY
		const { supabase } = createHubClient([
			{
				api_key: 'sk-org-b',
				metadata: { model: 'gpt-4o' },
				platform_id: 'chatgpt',
				organization_id: 'org-b',
			},
		])

		const result = await getChatgptForWhatsapp(supabase, 'org-a')

		expect(result).toBeNull()
	})

	it('usa OPENAI_API_KEY da plataforma se a org nao tiver conexao no hub', async () => {
		process.env.OPENAI_API_KEY = 'sk-platform'
		const { supabase } = createHubClient([
			{
				api_key: 'sk-org-b',
				metadata: { model: 'gpt-4o' },
				platform_id: 'chatgpt',
				organization_id: 'org-b',
			},
		])

		const result = await getChatgptForWhatsapp(supabase, 'org-a')

		expect(result).toEqual({ apiKey: 'sk-platform', model: 'gpt-5-mini' })
	})
})
