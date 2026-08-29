import { after, NextResponse } from 'next/server'
import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import { resolveMeliWebhookOrganizationId } from '@/lib/integrations/mercado-livre/resolve-meli-webhook-org'
import {
	isMeliOrdersTopic,
	parseMeliWebhook,
} from '@/lib/integrations/mercado-livre/webhooks'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type MeliRoutingRejectReason = 'missing_user_id' | 'organization_unresolved'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

function rejectErrorMessage(reason: MeliRoutingRejectReason): string {
	switch (reason) {
		case 'missing_user_id':
			return 'Webhook rejeitado: user_id ausente na notificação.'
		case 'organization_unresolved':
			return 'Webhook rejeitado: nenhuma conexão Mercado Livre corresponde ao user_id informado.'
		default:
			return 'Webhook rejeitado.'
	}
}

function enrichPayloadWithIngressDebug(
	payload: unknown,
	debug: {
		reason: MeliRoutingRejectReason
		user_id?: string | null
		topic?: string | null
	},
): object {
	const base =
		payload && typeof payload === 'object' && !Array.isArray(payload)
			? { ...(payload as Record<string, unknown>) }
			: { raw: payload }

	return {
		...base,
		_webhook_ingress: debug,
	}
}

async function resolveAuditOrganizationId(
	supabase: ServiceClient,
	userId: string | null,
): Promise<string | null> {
	const strict = await resolveMeliWebhookOrganizationId(supabase, userId)
	if (strict) return strict

	const { data: hostOrg } = await supabase
		.from('organizations')
		.select('id')
		.eq('is_host', true)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle()

	return hostOrg?.id ? String(hostOrg.id) : null
}

async function persistErrorWebhook(
	supabase: ServiceClient,
	input: {
		organizationId: string
		eventType: string
		externalId: string | null
		payload: object
		reason: MeliRoutingRejectReason
	},
): Promise<void> {
	const { error } = await supabase.from('integration_webhooks').insert({
		organization_id: input.organizationId,
		platform_id: MELI_PLATFORM_ID,
		event_type: input.eventType,
		external_id: input.externalId,
		payload: input.payload,
		status: 'error',
		error_message: rejectErrorMessage(input.reason),
	})

	if (error) {
		console.error('[meli webhook] error_webhook_insert_failed', {
			reason: input.reason,
			eventType: input.eventType,
			message: error.message,
		})
	}
}

async function recordRejectedWebhook(input: {
	payload: unknown
	externalId: string | null
	userId: string | null
	topic: string | null
	reason: MeliRoutingRejectReason
}): Promise<void> {
	try {
		const supabase = createSupabaseServiceClient()
		const organizationId = await resolveAuditOrganizationId(
			supabase,
			input.userId,
		)
		if (!organizationId) return

		await persistErrorWebhook(supabase, {
			organizationId,
			eventType: `routing.${input.reason}`,
			externalId: input.externalId,
			payload: enrichPayloadWithIngressDebug(input.payload, {
				reason: input.reason,
				user_id: input.userId,
				topic: input.topic,
			}),
			reason: input.reason,
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		console.error('[meli webhook] record_rejected_failed', {
			reason: input.reason,
			message,
		})
	}
}

function isConnectivityPing(rawBody: string): boolean {
	const trimmed = String(rawBody || '').trim()
	return (
		trimmed === '' ||
		trimmed === '{}' ||
		trimmed === '[]' ||
		trimmed === 'ok' ||
		trimmed === '""'
	)
}

export async function GET() {
	return NextResponse.json(
		{ ok: true, endpoint: 'mercado-livre-webhook' },
		{ status: 200 },
	)
}

export async function POST(request: Request) {
	let rawBody: string
	try {
		rawBody = await request.text()
	} catch {
		return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
	}

	if (isConnectivityPing(rawBody)) {
		return NextResponse.json({ ok: true, ping: true }, { status: 200 })
	}

	let payload: unknown
	try {
		payload = rawBody ? JSON.parse(rawBody) : {}
	} catch {
		return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
	}

	const parsed = parseMeliWebhook(payload)

	if (!isMeliOrdersTopic(parsed.topic)) {
		return NextResponse.json(
			{ ok: true, ignored: true, topic: parsed.topic },
			{ status: 200 },
		)
	}

	const externalId = parsed.orderId
	const routingReason: MeliRoutingRejectReason | null = !parsed.userId
		? 'missing_user_id'
		: null

	const supabase = createSupabaseServiceClient()
	const organizationId = routingReason
		? null
		: await resolveMeliWebhookOrganizationId(supabase, parsed.userId)

	const unresolvedReason: MeliRoutingRejectReason | null =
		!routingReason && !organizationId
			? 'organization_unresolved'
			: routingReason

	if (unresolvedReason) {
		console.warn('[meli webhook] rejected_routing', {
			reason: unresolvedReason,
			userId: parsed.userId,
			topic: parsed.topic,
			externalId,
		})

		await recordRejectedWebhook({
			payload,
			externalId,
			userId: parsed.userId,
			topic: parsed.topic,
			reason: unresolvedReason,
		})

		return NextResponse.json({ error: unresolvedReason }, { status: 409 })
	}

	const { data: row, error } = await supabase
		.from('integration_webhooks')
		.insert({
			organization_id: organizationId,
			platform_id: MELI_PLATFORM_ID,
			event_type: parsed.topic,
			external_id: externalId,
			payload,
			status: 'pending',
		})
		.select('id')
		.single()

	if (error || !row) {
		console.error('[meli webhook] insert error', {
			topic: parsed.topic,
			externalId,
			userId: parsed.userId,
			message: error?.message ?? null,
		})
		return NextResponse.json({ error: 'db_error' }, { status: 500 })
	}

	const webhookId = String(row.id)
	after(async () => {
		try {
			const { processMeliWebhook } = await import(
				'@/lib/integrations/mercado-livre/webhook-service'
			)
			await processMeliWebhook(webhookId)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown_error'
			console.error('[meli webhook] process error', { id: webhookId, message })
		}
	})

	return NextResponse.json({ ok: true, id: webhookId }, { status: 200 })
}
