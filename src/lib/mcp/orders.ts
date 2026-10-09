import type { SupabaseClient } from '@supabase/supabase-js'
import type { McpActor } from '@/lib/mcp/actor'
import {
	parseOrderCommentInput,
	parseOrderRef,
	parseOrderStatusInput,
} from '@/lib/mcp/schemas'
import { mcpText } from '@/lib/mcp/text'
import { applyOrderStatusChange } from '@/lib/orders/apply-order-status-change'
import {
	getOrderStatusLabel,
	ORDER_STATUS_SET,
} from '@/lib/orders/order-status'
import {
	buildServiceOrdersMacroQOrClause,
	escapeIlikePattern,
} from '@/lib/portal/portal-ordens-macro-search'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const LIST_LIMIT = 20

const ORDER_SELECT =
	'id, display_number, status, title, created_at, updated_at, estimated_ready_at, closed_at, customer_description, customers(full_name, company_name, trade_name, mobile_phone), device_models(model, device_types(name, device_brands(name)))'

export async function buscarOrdens(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { q?: string; status?: string },
) {
	const q = String(input.q ?? '').trim()
	const status = String(input.status ?? '').trim()
	if (status && !ORDER_STATUS_SET.has(status)) {
		return mcpText(
			'Status inválido. Use um dos status da ordem de serviço.',
			true,
		)
	}
	if (!q && !status) {
		return mcpText(
			'Informe um termo (número, cliente ou aparelho) ou um status.',
			true,
		)
	}

	let orClause = ''
	if (q) {
		const customerIds = await findCustomerIds(supabase, actor.organizationId, q)
		const deviceIds = await findDeviceModelIds(supabase, q)
		const macro = buildServiceOrdersMacroQOrClause(q, customerIds)
		const devicePart =
			deviceIds.length > 0 ? `device_model_id.in.(${deviceIds.join(',')})` : ''
		orClause = [macro, devicePart].filter(Boolean).join(',')
		if (!orClause && !status) {
			return mcpText(
				'Informe ao menos 2 caracteres, um número de OS ou um status.',
				true,
			)
		}
	}

	let query = supabase
		.from('service_orders')
		.select(ORDER_SELECT)
		.eq('organization_id', actor.organizationId)

	if (status) query = query.eq('status', status)
	if (orClause) query = query.or(orClause)

	const { data, error } = await query
		.order('updated_at', { ascending: false })
		.limit(LIST_LIMIT)

	if (error) {
		console.error('[mcp buscar_ordens]', error)
		return mcpText('Não foi possível buscar as ordens.', true)
	}

	const rows = data ?? []
	if (rows.length === 0) return mcpText('Nenhuma ordem encontrada.')
	return mcpText(rows.map((row) => formatOrderLine(row as OrderRow)).join('\n'))
}

export async function obterOrdem(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { id?: string; numero?: string },
) {
	const ref = parseOrderRef(input)
	if (ref.ok === false) return mcpText(orderRefMessage(ref.error), true)

	const row = await loadOrder(supabase, actor.organizationId, ref)
	if (!row) return mcpText('Ordem não encontrada nesta organização.', true)
	if (row.organization_id !== actor.organizationId) {
		return mcpText('Ordem não encontrada nesta organização.', true)
	}
	return mcpText(formatOrderDetail(row))
}

export async function atualizarStatusOrdem(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { id?: string; numero?: string; status?: string },
) {
	const parsed = parseOrderStatusInput(input)
	if (parsed.ok === false)
		return mcpText(orderStatusMessage(parsed.error), true)

	const row = await loadOrder(supabase, actor.organizationId, parsed.ref)
	if (!row || row.organization_id !== actor.organizationId) {
		return mcpText('Ordem não encontrada nesta organização.', true)
	}

	const result = await applyOrderStatusChange(supabase, {
		orderId: row.id,
		nextStatus: parsed.status,
		editorUserId: actor.userId,
	})

	if (result.ok === false) {
		if (result.error === 'finalize_blockers') {
			const parts: string[] = []
			if (result.exitIncomplete) parts.push('faltam considerações de saída')
			if (result.warrantyMissing) parts.push('faltam termos de garantia')
			const detail =
				parts.length > 0 ? parts.join('; ') : 'há pendências de finalização'
			return mcpText(`Não alterei o status. Para finalizar, ${detail}.`, true)
		}
		if (result.error === 'stock_sync_failed') {
			return mcpText(
				'Não alterei o status: falhou a sincronização de estoque.',
				true,
			)
		}
		return mcpText('Não foi possível alterar o status.', true)
	}

	return mcpText(
		`Status da OS ${row.display_number ?? row.id} atualizado para ${getOrderStatusLabel(parsed.status)}.`,
	)
}

export async function comentarOrdem(
	supabase: SupabaseClient,
	actor: McpActor,
	input: { id?: string; numero?: string; texto?: string },
) {
	const parsed = parseOrderCommentInput(input)
	if (parsed.ok === false)
		return mcpText(orderCommentMessage(parsed.error), true)

	const row = await loadOrder(supabase, actor.organizationId, parsed.ref)
	if (!row || row.organization_id !== actor.organizationId) {
		return mcpText('Ordem não encontrada nesta organização.', true)
	}

	const { error } = await supabase
		.from('service_order_internal_comments')
		.insert({
			service_order_id: row.id,
			organization_id: actor.organizationId,
			author_user_id: actor.userId,
			author_display_name: actor.authorDisplayName,
			content: parsed.content,
		})

	if (error) {
		console.error('[mcp comentar_ordem]', error)
		return mcpText('Não foi possível gravar o comentário.', true)
	}

	return mcpText(
		`Comentário interno gravado na OS ${row.display_number ?? row.id}.`,
	)
}

type OrderRef = { id?: string; displayNumber?: number }

type OrderRow = {
	id: string
	organization_id?: string | null
	display_number?: number | null
	status?: string | null
	title?: string | null
	created_at?: string | null
	updated_at?: string | null
	estimated_ready_at?: string | null
	closed_at?: string | null
	customer_description?: string | null
	customers?: unknown
	device_models?: unknown
}

async function loadOrder(
	supabase: SupabaseClient,
	organizationId: string,
	ref: OrderRef,
): Promise<OrderRow | null> {
	let query = supabase
		.from('service_orders')
		.select(`${ORDER_SELECT}, organization_id`)
		.eq('organization_id', organizationId)

	if (ref.id) query = query.eq('id', ref.id)
	else query = query.eq('display_number', ref.displayNumber)

	const { data, error } = await query.maybeSingle()
	if (error || !data) return null
	return data as OrderRow
}

async function findCustomerIds(
	supabase: SupabaseClient,
	organizationId: string,
	rawQ: string,
): Promise<string[]> {
	const trimmed = rawQ.trim()
	if (trimmed.length < 2) return []

	const esc = safeIlike(trimmed)
	const parts = [
		`full_name.ilike.%${esc}%`,
		`company_name.ilike.%${esc}%`,
		`trade_name.ilike.%${esc}%`,
	]
	const digits = trimmed.replace(/\D/g, '')
	if (digits.length >= 3) {
		const dEsc = safeIlike(digits)
		parts.push(`cpf.ilike.%${dEsc}%`, `cnpj.ilike.%${dEsc}%`)
	}

	const { data, error } = await supabase
		.from('customers')
		.select('id')
		.eq('organization_id', organizationId)
		.or(parts.join(','))
		.limit(40)

	if (error) return []
	return [
		...new Set(
			(data ?? [])
				.map((row) => String(row.id))
				.filter((id) => parseOptionalUuid(id)),
		),
	]
}

async function findDeviceModelIds(
	supabase: SupabaseClient,
	rawQ: string,
): Promise<string[]> {
	const trimmed = rawQ.trim()
	if (trimmed.length < 2) return []
	const esc = safeIlike(trimmed)
	const { data, error } = await supabase
		.from('device_models')
		.select('id')
		.ilike('model', `%${esc}%`)
		.limit(40)

	if (error) return []
	return (data ?? [])
		.map((row) => String(row.id))
		.filter((id) => parseOptionalUuid(id))
}

function safeIlike(raw: string) {
	return escapeIlikePattern(raw).replace(/[(),]/g, '')
}

function formatOrderLine(row: OrderRow) {
	const number = row.display_number ?? row.id
	const status = getOrderStatusLabel(String(row.status || ''))
	const title = String(row.title || '').trim() || 'sem título'
	return `OS ${number} · ${status} · ${title} · ${customerLabel(row.customers)} · ${deviceLabel(row.device_models)}`
}

function formatOrderDetail(row: OrderRow) {
	const description = String(row.customer_description || '').trim()
	const clipped =
		description.length > 500 ? `${description.slice(0, 500)}...` : description
	return [
		formatOrderLine(row),
		`id: ${row.id}`,
		row.estimated_ready_at ? `previsão: ${row.estimated_ready_at}` : '',
		row.closed_at ? `encerrada: ${row.closed_at}` : '',
		clipped ? `relato: ${clipped}` : '',
	]
		.filter(Boolean)
		.join('\n')
}

function customerLabel(value: unknown) {
	const row = firstRow(value)
	if (!row) return 'sem cliente'
	return (
		text(row.full_name) ||
		text(row.trade_name) ||
		text(row.company_name) ||
		'sem cliente'
	)
}

function deviceLabel(value: unknown) {
	const row = firstRow(value)
	if (!row) return 'aparelho não informado'
	const typeRow = firstRow(row.device_types)
	const brandRow = typeRow ? firstRow(typeRow.device_brands) : null
	const parts = [
		text(brandRow?.name),
		text(typeRow?.name),
		text(row.model),
	].filter(Boolean)
	return parts.join(' ') || 'aparelho não informado'
}

function firstRow(value: unknown): Record<string, unknown> | null {
	if (Array.isArray(value)) {
		const first = value[0]
		return first && typeof first === 'object'
			? (first as Record<string, unknown>)
			: null
	}
	if (value && typeof value === 'object')
		return value as Record<string, unknown>
	return null
}

function text(value: unknown) {
	return typeof value === 'string' ? value.trim() : ''
}

function orderRefMessage(error: string) {
	if (error === 'invalid_id') return 'Id da ordem inválido.'
	if (error === 'invalid_number') return 'Número da ordem inválido.'
	return 'Informe o número ou o id da ordem.'
}

function orderStatusMessage(error: string) {
	if (error === 'invalid_status')
		return 'Status inválido. Use um dos status da ordem de serviço.'
	return orderRefMessage(error)
}

function orderCommentMessage(error: string) {
	if (error === 'content_required') return 'Informe o texto do comentário.'
	if (error === 'content_too_long')
		return 'Comentário acima de 6000 caracteres.'
	return orderRefMessage(error)
}
