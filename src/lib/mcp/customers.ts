import type { SupabaseClient } from '@supabase/supabase-js'
import { CUSTOMER_PORTAL_FIELDS } from '@/lib/customers/fields'
import type { McpActor } from '@/lib/mcp/actor'
import { buildCustomerPatch } from '@/lib/mcp/schemas'
import { mcpText } from '@/lib/mcp/text'
import { escapeIlikePattern } from '@/lib/portal/portal-ordens-macro-search'
import { formatCnpj, formatCpf } from '@/lib/utils/format-cpf-cnpj'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { onlyDigits } from '@/lib/utils/strings'

const LIST_LIMIT = 20

export async function buscarClientes(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { q?: string },
) {
	const q = String(input.q ?? '').trim()
	if (q.length < 2)
		return mcpText('Informe ao menos 2 caracteres (nome ou documento).', true)

	const digits = onlyDigits(q)
	const onlyDigitsQuery = digits.length >= 5 && !/[a-zA-ZÀ-ÿ]/.test(q)

	let query = supabase
		.from('customers')
		.select(CUSTOMER_PORTAL_FIELDS)
		.eq('organization_id', actor.organizationId)

	if (onlyDigitsQuery) {
		const prefix = digits.slice(0, 5)
		const cpfPrefix = formatCpf(prefix)
		const cnpjPrefix = formatCnpj(prefix)
		const parts = [
			`cpf.like.${prefix}%`,
			cpfPrefix ? `cpf.like.${cpfPrefix}%` : '',
			`cnpj.like.${prefix}%`,
			cnpjPrefix ? `cnpj.like.${cnpjPrefix}%` : '',
		].filter(Boolean)
		query = query.or(parts.join(','))
	} else {
		const esc = escapeIlikePattern(q).replace(/[(),]/g, '')
		query = query.or(
			`full_name.ilike.%${esc}%,company_name.ilike.%${esc}%,trade_name.ilike.%${esc}%`,
		)
	}

	const { data, error } = await query
		.order('full_name', { ascending: true, nullsFirst: false })
		.limit(LIST_LIMIT)

	if (error) {
		console.error('[mcp buscar_clientes]', error)
		return mcpText('Não foi possível buscar os clientes.', true)
	}

	const rows = data ?? []
	if (rows.length === 0) return mcpText('Nenhum cliente encontrado.')
	return mcpText(
		rows.map((row) => formatCustomer(row as CustomerRow)).join('\n'),
	)
}

export async function obterCliente(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { id?: string },
) {
	const id = parseOptionalUuid(input.id)
	if (!id) return mcpText('Id do cliente inválido.', true)

	const { data, error } = await supabase
		.from('customers')
		.select(`${CUSTOMER_PORTAL_FIELDS}, organization_id`)
		.eq('id', id)
		.eq('organization_id', actor.organizationId)
		.maybeSingle()

	if (error) {
		console.error('[mcp obter_cliente]', error)
		return mcpText('Não foi possível carregar o cliente.', true)
	}
	if (!data || data.organization_id !== actor.organizationId) {
		return mcpText('Cliente não encontrado nesta organização.', true)
	}

	return mcpText(formatCustomer(data as CustomerRow))
}

export async function atualizarCliente(
	supabase: SupabaseClient,
	actor: McpActor,
	input: Record<string, unknown>,
) {
	const parsed = buildCustomerPatch(input)
	if (parsed.ok === false)
		return mcpText(customerPatchMessage(parsed.error), true)

	const { data: existing, error: loadError } = await supabase
		.from('customers')
		.select('id, organization_id')
		.eq('id', parsed.id)
		.maybeSingle()

	if (loadError) {
		console.error('[mcp atualizar_cliente]', loadError)
		return mcpText('Não foi possível atualizar o cliente.', true)
	}
	if (!existing || existing.organization_id !== actor.organizationId) {
		return mcpText('Cliente não encontrado nesta organização.', true)
	}

	const { data, error } = await supabase
		.from('customers')
		.update(parsed.patch)
		.eq('id', parsed.id)
		.eq('organization_id', actor.organizationId)
		.select('id')
		.maybeSingle()

	if (error || !data) {
		console.error('[mcp atualizar_cliente]', error)
		return mcpText('Não foi possível atualizar o cliente.', true)
	}

	return mcpText(`Cliente ${data.id} atualizado.`)
}

type CustomerRow = {
	id?: string
	organization_id?: string | null
	full_name?: string | null
	company_name?: string | null
	trade_name?: string | null
	email?: string | null
	phone?: string | null
	mobile_phone?: string | null
	cpf?: string | null
	cnpj?: string | null
	city?: string | null
}

function formatCustomer(row: CustomerRow) {
	const name = String(
		row.trade_name || row.full_name || row.company_name || 'sem nome',
	).trim()
	const doc = row.cnpj || row.cpf || ''
	const phone = row.mobile_phone || row.phone || ''
	return [
		`${name}`,
		doc ? `doc ${doc}` : '',
		phone ? `tel ${phone}` : '',
		row.email || '',
		row.city || '',
		`id ${row.id}`,
	]
		.filter(Boolean)
		.join(' · ')
}

function customerPatchMessage(error: string) {
	if (error === 'document_locked')
		return 'CPF e CNPJ não podem ser alterados por este canal.'
	if (error === 'field_forbidden')
		return 'Campo fora da lista permitida (nome, e-mail, telefone, contato e endereço).'
	if (error === 'empty') return 'Informe ao menos um campo para atualizar.'
	if (error === 'invalid_id') return 'Id do cliente inválido.'
	return 'Dados do cliente inválidos.'
}
