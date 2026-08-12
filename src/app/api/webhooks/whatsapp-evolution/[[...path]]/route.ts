import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
	findEvolutionHubByInstance,
	WHATSAPP_EVOLUTION_PLATFORM_ID,
} from '@/lib/whatsapp/evolution-hub-config'
import { normalizeEvolutionWebhookPayload } from '@/lib/whatsapp/normalize-evolution-webhook-payload'
import { processEvolutionWebhookPayload } from '@/lib/whatsapp/process-evolution-webhook'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ path?: string[] }> }

/** Aceita também sufixos de evento (Evolution «Webhook by Events»), ex.: .../messages-upsert */
export async function POST(request: Request, ctx: RouteCtx) {
	const secret = process.env.WHATSAPP_EVOLUTION_WEBHOOK_SECRET?.trim() || ''

	let rawBody = ''
	try {
		rawBody = await request.text()
	} catch {
		return NextResponse.json(
			{ ok: false, error: 'invalid_body' },
			{ status: 400 },
		)
	}

	if (secret) {
		const h = (
			request.headers.get('x-whatsapp-evolution-secret') ??
			request.headers.get('X-WhatsApp-Evolution-Secret') ??
			''
		).trim()
		if (h !== secret) {
			return NextResponse.json(
				{ ok: false, error: 'unauthorized' },
				{ status: 401 },
			)
		}
	}

	let payload: Record<string, unknown>
	try {
		payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
	} catch {
		return NextResponse.json(
			{ ok: false, error: 'invalid_json' },
			{ status: 400 },
		)
	}

	const { path: pathSegments } = await ctx.params
	payload = normalizeEvolutionWebhookPayload(payload, pathSegments)

	let supabase
	try {
		supabase = createSupabaseServiceClient()
	} catch (e) {
		console.error('[whatsapp-evolution webhook] service client', e)
		return NextResponse.json(
			{ ok: false, error: 'server_misconfigured' },
			{ status: 500 },
		)
	}

	const instance =
		typeof payload.instance === 'string' ? payload.instance.trim() : ''
	const hub = instance
		? await findEvolutionHubByInstance(supabase, instance)
		: null

	if (!instance) {
		console.warn('[whatsapp-evolution] webhook sem campo instance')
	} else if (!hub) {
		console.warn('[whatsapp-evolution] no hub for instance', instance)
	}

	try {
		if (instance && hub?.organization_id) {
			await supabase.from('integration_webhooks').insert({
				organization_id: hub.organization_id,
				platform_id: WHATSAPP_EVOLUTION_PLATFORM_ID,
				event_type: String(payload.event || 'unknown'),
				external_id: instance,
				payload: payload as object,
				status: 'pending',
			})
		}
	} catch (e) {
		console.error('[whatsapp-evolution webhook] log insert', e)
	}

	const devDebug: Record<string, unknown> = {}
	let ingested = 0

	try {
		const stats = await processEvolutionWebhookPayload(supabase, payload)
		ingested = stats.ingested_in + stats.ingested_out + stats.deleted
		if (process.env.NODE_ENV === 'development') {
			devDebug.stats = stats
		}
		if (stats.ingested_in + stats.ingested_out === 0 && !hub) {
			devDebug.hub = 'not_found_for_instance'
		}
	} catch (e) {
		console.error('[whatsapp-evolution webhook] process', e)
		return NextResponse.json(
			{ ok: false, error: 'process_failed' },
			{ status: 500 },
		)
	}

	if (process.env.NODE_ENV === 'development') {
		return NextResponse.json({
			ok: true,
			ingested,
			instance: instance || null,
			hub_found: Boolean(hub),
			...devDebug,
		})
	}

	return NextResponse.json({ ok: true })
}
