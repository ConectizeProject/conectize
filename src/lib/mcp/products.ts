import type { SupabaseClient } from '@supabase/supabase-js'
import type { McpActor } from '@/lib/mcp/actor'
import { buildProductPatch, type ProductPatchResult } from '@/lib/mcp/schemas'
import { mcpText } from '@/lib/mcp/text'
import { escapeIlikePattern } from '@/lib/portal/portal-ordens-macro-search'
import { effectiveSearchTokens } from '@/lib/products/product-search'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const LIST_LIMIT = 20
const PRODUCT_FIELDS =
	'id, name, sku, barcode, sale_price_cents, is_active, organization_id'

export type ProductRowRef = {
	id: string
	organization_id: string | null
}

export async function applyMcpProductUpdate(
	deps: {
		loadById: (id: string) => Promise<ProductRowRef | null>
		save: (
			id: string,
			organizationId: string,
			patch: Record<string, string | number | boolean | null>,
		) => Promise<'updated' | 'not_found' | 'db_error'>
	},
	organizationId: string,
	input: Record<string, unknown>,
): Promise<
	| ProductPatchResult
	| { ok: false; error: 'wrong_organization' | 'not_found' | 'db_error' }
	| { ok: true; id: string }
> {
	const parsed = buildProductPatch(input)
	if (parsed.ok === false) return parsed

	const existing = await deps.loadById(parsed.id)
	if (!existing) return { ok: false, error: 'not_found' }
	if (existing.organization_id !== organizationId)
		return { ok: false, error: 'wrong_organization' }

	const saved = await deps.save(parsed.id, organizationId, parsed.patch)
	if (saved === 'updated') return { ok: true, id: parsed.id }
	if (saved === 'not_found') return { ok: false, error: 'not_found' }
	return { ok: false, error: 'db_error' }
}

export async function buscarProdutos(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { q?: string },
) {
	const tokens = effectiveSearchTokens(String(input.q ?? ''))
		.map((token) => escapeIlikePattern(token).replace(/[(),]/g, ''))
		.filter((token) => token.length > 0)

	if (tokens.length === 0) {
		return mcpText('Informe nome, SKU ou código de barras.', true)
	}

	let query = supabase
		.from('products')
		.select(PRODUCT_FIELDS)
		.eq('organization_id', actor.organizationId)

	for (const token of tokens) {
		query = query.or(
			`name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
		)
	}

	const { data, error } = await query
		.order('name', { ascending: true })
		.limit(LIST_LIMIT)

	if (error) {
		console.error('[mcp buscar_produtos]', error)
		return mcpText('Não foi possível buscar os produtos.', true)
	}

	const rows = data ?? []
	if (rows.length === 0) return mcpText('Nenhum produto encontrado.')
	return mcpText(rows.map((row) => formatProduct(row as ProductRow)).join('\n'))
}

export async function obterProduto(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { id?: string; sku?: string },
) {
	const id = parseOptionalUuid(input.id)
	const sku = String(input.sku ?? '').trim()
	if (!id && !sku) return mcpText('Informe o id ou o SKU do produto.', true)

	let query = supabase
		.from('products')
		.select(PRODUCT_FIELDS)
		.eq('organization_id', actor.organizationId)

	if (id) query = query.eq('id', id)
	else query = query.eq('sku', sku)

	const { data, error } = await query.maybeSingle()
	if (error) {
		console.error('[mcp obter_produto]', error)
		return mcpText('Não foi possível carregar o produto.', true)
	}
	if (!data || data.organization_id !== actor.organizationId) {
		return mcpText('Produto não encontrado nesta organização.', true)
	}
	return mcpText(formatProduct(data as ProductRow))
}

export async function atualizarProduto(
	supabase: SupabaseClient,
	actor: McpActor,
	input: Record<string, unknown>,
) {
	const result = await applyMcpProductUpdate(
		{
			loadById: async (id) => {
				const { data, error } = await supabase
					.from('products')
					.select('id, organization_id')
					.eq('id', id)
					.maybeSingle()
				if (error || !data) return null
				return {
					id: String(data.id),
					organization_id: data.organization_id
						? String(data.organization_id)
						: null,
				}
			},
			save: async (id, organizationId, patch) => {
				const { data, error } = await supabase
					.from('products')
					.update(patch)
					.eq('id', id)
					.eq('organization_id', organizationId)
					.select('id')
					.maybeSingle()
				if (error) return 'db_error'
				return data?.id ? 'updated' : 'not_found'
			},
		},
		actor.organizationId,
		input,
	)

	if (result.ok === false)
		return mcpText(productPatchMessage(result.error), true)
	return mcpText(
		`Produto ${result.id} atualizado no portal. O Bling não sincroniza por este canal.`,
	)
}

type ProductRow = {
	id?: string
	organization_id?: string | null
	name?: string | null
	sku?: string | null
	barcode?: string | null
	sale_price_cents?: number | null
	is_active?: boolean | null
}

function formatProduct(row: ProductRow) {
	const price = formatCents(row.sale_price_cents)
	const active = row.is_active === false ? 'inativo' : 'ativo'
	return [
		String(row.name || 'sem nome'),
		row.sku ? `SKU ${row.sku}` : '',
		row.barcode ? `EAN ${row.barcode}` : '',
		price,
		active,
		`id ${row.id}`,
	]
		.filter(Boolean)
		.join(' · ')
}

function formatCents(cents: number | null | undefined) {
	if (cents == null) return 'sem preço'
	const reais = (cents / 100).toFixed(2).replace('.', ',')
	return `R$ ${reais}`
}

function productPatchMessage(error: string) {
	if (error === 'field_forbidden') {
		return 'Campo fora da lista permitida (nome, SKU, código de barras, preço de venda e ativo). Custo, fiscal e estoque não entram.'
	}
	if (error === 'invalid_price')
		return 'Preço de venda deve ser um inteiro em centavos, zero ou maior.'
	if (error === 'invalid_barcode') return 'Código de barras inválido.'
	if (error === 'name_required')
		return 'O nome do produto não pode ficar vazio.'
	if (error === 'empty') return 'Informe ao menos um campo para atualizar.'
	if (error === 'invalid_id') return 'Id do produto inválido.'
	if (error === 'wrong_organization' || error === 'not_found') {
		return 'Produto não encontrado nesta organização.'
	}
	return 'Não foi possível atualizar o produto.'
}
