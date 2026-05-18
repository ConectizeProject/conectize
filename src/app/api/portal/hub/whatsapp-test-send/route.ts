import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { resolveOrganizationWhatsappOutbound } from '@/lib/whatsapp/whatsapp-outbound'

/**
 * Envia mensagem de teste seguindo a mesma prioridade do inbox (Official vs Evolution).
 */
export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { to?: string; text?: string } | null
  const to = String(body?.to || '').trim()
  const { data: orgRow } = await auth.supabase
    .from('organizations')
    .select('name')
    .eq('id', auth.organizationId)
    .maybeSingle()
  const brand = String(orgRow?.name || '').trim()
  const defaultTestText = brand
    ? `Teste ${brand} — integração WhatsApp OK.`
    : 'Teste de integração WhatsApp OK.'
  const text = String(body?.text || defaultTestText).trim()
  if (!to) {
    return NextResponse.json({ ok: false, error: 'to_required' }, { status: 400 })
  }

  const outbound = await resolveOrganizationWhatsappOutbound(
    auth.supabase,
    auth.organizationId,
  )

  if (!outbound) {
    return NextResponse.json({ ok: false, error: 'whatsapp_not_configured' }, { status: 400 })
  }

  const result = await outbound.send({
    toE164Digits: to,
    body: text,
  })

  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: 'send_failed', detail: result.error, channel: outbound.provider },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    message_id: result.messageId ?? null,
    channel: outbound.provider,
  })
}
