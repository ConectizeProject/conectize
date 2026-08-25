import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { sendViaEvolutionHub } from '@/lib/whatsapp/send-evolution-order-auto-message'
import {
  buildShareQuoteWhatsappMessage,
  loadQuoteWhatsappContext,
} from '@/lib/quotes/load-quote-whatsapp'

export async function GET (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const quoteId = parseOptionalUuid(rawId)
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const ctx = await loadQuoteWhatsappContext(auth.supabase, quoteId)
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const evolutionAvailable = ctx.evolutionReady != null
  const message = buildShareQuoteWhatsappMessage(ctx)
  const waMeUrl =
    ctx.toTarget && message
      ? `https://wa.me/${ctx.toTarget}?text=${encodeURIComponent(message)}`
      : null

  return NextResponse.json({
    ok: true,
    message,
    to: ctx.toTarget || null,
    wa_me_url: waMeUrl,
    evolution_available: evolutionAvailable,
    has_phone: Boolean(ctx.toTarget),
    display_number: ctx.displayNumber,
  })
}

export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const quoteId = parseOptionalUuid(rawId)
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const textOverride = typeof body?.text === 'string' ? body.text.trim() : ''

  const ctx = await loadQuoteWhatsappContext(auth.supabase, quoteId)
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
    return NextResponse.json({ ok: false, error: 'missing_phone' }, { status: 400 })
  }

  const message = textOverride || buildShareQuoteWhatsappMessage(ctx)
  if (!message.trim()) {
    return NextResponse.json({ ok: false, error: 'empty_message' }, { status: 400 })
  }

  const sent = await sendViaEvolutionHub(ctx.evolutionReady, {
    toTarget: ctx.toTarget,
    body: message,
  })
  if (sent.ok === false) {
    return NextResponse.json(
      { ok: false, error: 'send_failed', detail: sent.error },
      { status: 502 },
    )
  }

  if (ctx.status === 'rascunho') {
    await auth.supabase
      .from('quotes')
      .update({ status: 'enviado' })
      .eq('id', quoteId)
      .eq('organization_id', auth.organizationId)
  }

  return NextResponse.json({
    ok: true,
    message_id: sent.messageId ?? null,
  })
}
