import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import {
	buildAutoOrderWhatsappMessage,
	buildShareOrderWhatsappMessage,
	loadOrderWhatsappContext,
	sendViaEvolutionHub,
} from '@/lib/whatsapp/send-evolution-order-auto-message'
import { isSendFailure } from '@/lib/whatsapp/whatsapp-cloud-client'

type PreviewMode = 'share' | 'os_opened' | 'os_ready_for_pickup'

function parseMode(raw: string | null): PreviewMode {
	const v = String(raw || 'share').trim()
	if (v === 'os_opened' || v === 'os_ready_for_pickup') return v
	return 'share'
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { id: rawId } = await params
	const orderId = parseOptionalUuid(rawId)
	if (!orderId) {
		return NextResponse.json(
			{ ok: false, error: 'invalid_id' },
			{ status: 400 },
		)
	}

	const mode = parseMode(new URL(request.url).searchParams.get('mode'))
	const ctx = await loadOrderWhatsappContext(auth.supabase, orderId)
	if (!ctx) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}

	const evolutionAvailable = ctx.evolutionReady != null
	const autoMessagesEnabled = ctx.autoMessagesHub != null

	let message = ''
	if (mode === 'share') {
		message = buildShareOrderWhatsappMessage(ctx)
	} else {
		message = buildAutoOrderWhatsappMessage(ctx, mode) || ''
	}

	const waMeUrl =
		ctx.toTarget && message
			? `https://wa.me/${ctx.toTarget}?text=${encodeURIComponent(message)}`
			: null

	return NextResponse.json({
		ok: true,
		mode,
		message,
		to: ctx.toTarget || null,
		wa_me_url: waMeUrl,
		evolution_available: evolutionAvailable,
		auto_messages_enabled: autoMessagesEnabled,
		has_phone: Boolean(ctx.toTarget),
		display_number: ctx.displayNumber,
	})
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { id: rawId } = await params
	const orderId = parseOptionalUuid(rawId)
	if (!orderId) {
		return NextResponse.json(
			{ ok: false, error: 'invalid_id' },
			{ status: 400 },
		)
	}

	const body = (await request.json().catch(() => null)) as {
		text?: unknown
		mode?: unknown
	} | null

	const mode = parseMode(body?.mode != null ? String(body.mode) : 'share')
	const textOverride = typeof body?.text === 'string' ? body.text.trim() : ''

	const ctx = await loadOrderWhatsappContext(auth.supabase, orderId)
	if (!ctx) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}
	if (!ctx.evolutionReady) {
		return NextResponse.json(
			{ ok: false, error: 'evolution_not_configured' },
			{ status: 400 },
		)
	}
	if (!ctx.toTarget) {
		return NextResponse.json(
			{ ok: false, error: 'missing_phone' },
			{ status: 400 },
		)
	}

	let message = textOverride
	if (!message) {
		if (mode === 'share') {
			message = buildShareOrderWhatsappMessage(ctx)
		} else {
			message = buildAutoOrderWhatsappMessage(ctx, mode) || ''
		}
	}
	if (!message.trim()) {
		return NextResponse.json(
			{ ok: false, error: 'empty_message' },
			{ status: 400 },
		)
	}

	const hub =
		mode === 'share'
			? ctx.evolutionReady
			: ctx.autoMessagesHub || ctx.evolutionReady

	const sent = await sendViaEvolutionHub(hub, {
		toTarget: ctx.toTarget,
		body: message,
	})
	if (isSendFailure(sent)) {
		return NextResponse.json(
			{ ok: false, error: 'send_failed', detail: sent.error },
			{ status: 502 },
		)
	}

	return NextResponse.json({
		ok: true,
		message_id: sent.messageId ?? null,
	})
}
