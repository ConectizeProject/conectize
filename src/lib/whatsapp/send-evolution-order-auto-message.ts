import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { buildOrderMessage } from '@/lib/ordem-share-message'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import { getSiteUrl } from '@/lib/utils/site-url'
import {
	type EvolutionAutoMessageEvent,
	pickEvolutionHubForAutoMessages,
	renderEvolutionAutoMessage,
	resolveEvolutionAutoMessageTemplate,
} from '@/lib/whatsapp/evolution-auto-messages'
import {
	type EvolutionHubRow,
	listEvolutionHubsForOrganization,
	resolveEvolutionApiBaseUrl,
	resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import { isSendFailure } from '@/lib/whatsapp/whatsapp-cloud-client'

type OrderCustomer = {
	is_company?: boolean | null
	full_name?: string | null
	company_name?: string | null
	trade_name?: string | null
	mobile_phone?: string | null
	contact_phone?: string | null
}

export type OrderWhatsappContext = {
	orderId: string
	organizationId: string
	displayNumber: string
	title: string
	status: string
	statusLabel: string
	estimatedReadyAt: string | null
	shareToken: string | null
	link: string
	device: string
	customerName: string
	firstName: string
	toTarget: string
	organizationName: string
	/** Soma dos serviços/produtos da OS, em centavos. */
	servicesTotalCents: number
	evolutionHubs: EvolutionHubRow[]
	evolutionReady: EvolutionHubRow | null
	autoMessagesHub: EvolutionHubRow | null
}

function firstRel<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

function customerFullName(customer: OrderCustomer | null): string {
	if (!customer) return ''
	if (customer.is_company) {
		return String(
			customer.company_name || customer.trade_name || customer.full_name || '',
		).trim()
	}
	return String(customer.full_name || customer.company_name || '').trim()
}

function customerFirstName(fullName: string): string {
	const first = fullName.trim().split(/\s+/).filter(Boolean)[0]
	return first || fullName
}

function buildDeviceLabel(deviceModel: Record<string, unknown> | null): string {
	if (!deviceModel) return ''
	const dtRaw = deviceModel.device_types
	const dt = (Array.isArray(dtRaw) ? dtRaw[0] : dtRaw) as Record<
		string,
		unknown
	> | null
	const brandRaw = dt?.device_brands
	const brandRow = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw
	const brandName = String(
		(brandRow as { name?: string } | null)?.name ?? '',
	).trim()
	const typeName = String((dt as { name?: string } | null)?.name ?? '').trim()
	const model = String(deviceModel.model ?? '').trim()
	return [brandName, typeName, model].filter(Boolean).join(' ')
}

function servicesTotalCentsFromRaw(raw: unknown): number {
	if (!raw) return 0
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		const data = parsed as Record<string, unknown>
		const items: unknown[] = Array.isArray(data?.items)
			? data.items
			: Array.isArray(parsed)
				? parsed
				: []
		let total = 0
		for (const item of items) {
			const i = item as Record<string, unknown>
			const kind = i.kind === 'product' ? 'product' : 'service'
			const quantity =
				kind === 'product'
					? Math.min(9999, Math.max(1, Number(i.quantity) || 1))
					: 1
			const unitValue = Math.max(
				0,
				Number(i.unitValueCents ?? i.valueCents ?? 0) || 0,
			)
			total += unitValue * quantity
		}
		return total
	} catch {
		return 0
	}
}

async function ensureShareToken(
	supabase: SupabaseClient,
	orderId: string,
	current: string | null,
): Promise<string | null> {
	const existing = String(current || '').trim()
	if (existing) return existing
	const token = randomUUID()
	const { error } = await supabase
		.from('service_orders')
		.update({ share_token: token })
		.eq('id', orderId)
	if (error) {
		console.error('[order-whatsapp] share_token', error)
		return null
	}
	return token
}

function pickEvolutionHubForSend(
	hubs: EvolutionHubRow[],
): EvolutionHubRow | null {
	const ready = hubs.filter((h) => {
		const instanceName = String(h.metadata.instance_name || '').trim()
		const apiKey = resolveEvolutionApiKey(h.access_token)
		const baseUrl = resolveEvolutionApiBaseUrl(h.metadata)
		return Boolean(instanceName && apiKey && baseUrl)
	})
	if (ready.length === 0) return null
	return (
		ready.find((h) => h.metadata.preferred_for_messages === true) ?? ready[0]
	)
}

export async function loadOrderWhatsappContext(
	supabase: SupabaseClient,
	orderIdRaw: string,
): Promise<OrderWhatsappContext | null> {
	const orderId = String(orderIdRaw || '').trim()
	if (!orderId) return null

	const { data: order, error: orderErr } = await supabase
		.from('service_orders')
		.select(
			`id, organization_id, display_number, title, status, estimated_ready_at, share_token, services,
       customers ( full_name, company_name, trade_name, is_company, mobile_phone, contact_phone ),
       device_models ( model, device_types ( name, device_brands ( name ) ) )`,
		)
		.eq('id', orderId)
		.maybeSingle()

	if (orderErr) {
		console.error('[order-whatsapp] order fetch', orderErr)
		return null
	}
	if (!order) return null

	const organizationId = String(order.organization_id || '').trim()
	if (!organizationId) return null

	const customer = firstRel(
		order.customers as OrderCustomer | OrderCustomer[] | null,
	)
	const phoneRaw = String(
		customer?.mobile_phone || customer?.contact_phone || '',
	).trim()
	const toTarget = formatPhoneForWhatsApp(phoneRaw)

	const shareToken = await ensureShareToken(
		supabase,
		orderId,
		order.share_token != null ? String(order.share_token) : null,
	)
	const origin = getSiteUrl().replace(/\/$/, '')
	const link = shareToken ? `${origin}/os/${shareToken}` : ''

	const deviceModel = firstRel(
		order.device_models as
			| Record<string, unknown>
			| Record<string, unknown>[]
			| null,
	)
	const { data: org } = await supabase
		.from('organizations')
		.select('name')
		.eq('id', organizationId)
		.maybeSingle()

	const evolutionHubs = await listEvolutionHubsForOrganization(
		supabase,
		organizationId,
	)
	const fullName = customerFullName(customer)
	const status = String(order.status || '')

	return {
		orderId,
		organizationId,
		displayNumber: String(order.display_number ?? ''),
		title: String(order.title || '').trim(),
		status,
		statusLabel: getOrderStatusLabel(status),
		estimatedReadyAt:
			order.estimated_ready_at != null
				? String(order.estimated_ready_at)
				: null,
		shareToken,
		link,
		device: buildDeviceLabel(deviceModel) || '-',
		customerName: fullName,
		firstName: customerFirstName(fullName),
		toTarget,
		organizationName: String(org?.name || '').trim(),
		servicesTotalCents: servicesTotalCentsFromRaw(
			(order as { services?: unknown }).services,
		),
		evolutionHubs,
		evolutionReady: pickEvolutionHubForSend(evolutionHubs),
		autoMessagesHub: pickEvolutionHubForAutoMessages(evolutionHubs),
	}
}

export function buildShareOrderWhatsappMessage(
	ctx: OrderWhatsappContext,
): string {
	return buildOrderMessage({
		displayNumber: ctx.displayNumber,
		title: ctx.title,
		customerName: ctx.customerName,
		device: ctx.device,
		status: ctx.statusLabel,
		estimatedReadyAt: ctx.estimatedReadyAt,
		orderHref: ctx.link,
		organizationName: ctx.organizationName,
	})
}

export function buildAutoOrderWhatsappMessage(
	ctx: OrderWhatsappContext,
	event: EvolutionAutoMessageEvent,
): string | null {
	const hub = ctx.autoMessagesHub
	if (!hub) return null
	const template = resolveEvolutionAutoMessageTemplate(
		hub.metadata.auto_message_templates,
		event,
	)
	if (!template.trim()) return null

	const previsaoFmt = formatDateTimeBr(ctx.estimatedReadyAt)
	const previsao = previsaoFmt === '-' ? '' : previsaoFmt
	const empresa = ctx.organizationName
	const empresaSufixo = empresa ? ` - ${empresa}` : ''
	const previsaoLinha = previsao ? `Previsão: ${previsao}` : ''

	const rendered = renderEvolutionAutoMessage(template, {
		nome: ctx.firstName,
		nome_completo: ctx.customerName,
		os: ctx.displayNumber,
		titulo: ctx.title,
		aparelho: ctx.device,
		status: ctx.statusLabel,
		previsao,
		previsao_linha: previsaoLinha,
		link: ctx.link,
		empresa,
		empresa_sufixo: empresaSufixo,
		valor_total: formatCentsBr(ctx.servicesTotalCents),
	})
	return rendered || null
}

export async function sendViaEvolutionHub(
	hub: EvolutionHubRow,
	opts: { toTarget: string; body: string },
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
	const apiKey = resolveEvolutionApiKey(hub.access_token)
	const baseUrl = resolveEvolutionApiBaseUrl(hub.metadata)
	const instanceName = String(hub.metadata.instance_name || '').trim()
	if (!apiKey || !baseUrl || !instanceName) {
		return { ok: false, error: 'evolution_not_ready' }
	}
	if (!opts.toTarget) return { ok: false, error: 'missing_phone' }
	if (!opts.body.trim()) return { ok: false, error: 'empty_message' }

	const sent = await sendEvolutionTextMessage({
		baseUrl,
		apiKey,
		instanceName,
		toTarget: opts.toTarget,
		body: opts.body,
	})
	if (isSendFailure(sent)) return { ok: false, error: sent.error }
	return { ok: true, messageId: sent.messageId }
}

export async function sendEvolutionOrderAutoMessage(
	supabase: SupabaseClient,
	opts: { orderId: string; event: EvolutionAutoMessageEvent },
): Promise<void> {
	const ctx = await loadOrderWhatsappContext(supabase, opts.orderId)
	if (!ctx) return
	const body = buildAutoOrderWhatsappMessage(ctx, opts.event)
	if (!body) return
	const hub = ctx.autoMessagesHub
	if (!hub) return
	const sent = await sendViaEvolutionHub(hub, {
		toTarget: ctx.toTarget,
		body,
	})
	if (isSendFailure(sent)) {
		console.error(
			'[evolution-auto-message] send failed',
			opts.event,
			opts.orderId,
			sent.error,
		)
	}
}

export async function notifyEvolutionOrderAutoMessage(
	supabase: SupabaseClient,
	opts: { orderId: string; event: EvolutionAutoMessageEvent },
): Promise<void> {
	try {
		await sendEvolutionOrderAutoMessage(supabase, opts)
	} catch (err) {
		console.error('[evolution-auto-message]', opts.event, opts.orderId, err)
	}
}

export async function notifyEvolutionOrderOpened(
	supabase: SupabaseClient,
	orderId: string,
): Promise<void> {
	await notifyEvolutionOrderAutoMessage(supabase, {
		orderId,
		event: 'os_opened',
	})
}

/** Mantido por compatibilidade; preferir confirmação no client antes do envio. */
export async function notifyEvolutionOrderReadyForPickup(
	supabase: SupabaseClient,
	opts: { orderId: string; previousStatus: string; nextStatus: string },
): Promise<void> {
	if (opts.nextStatus !== 'aguardando_retirada') return
	if (opts.previousStatus === 'aguardando_retirada') return
	await notifyEvolutionOrderAutoMessage(supabase, {
		orderId: opts.orderId,
		event: 'os_ready_for_pickup',
	})
}
