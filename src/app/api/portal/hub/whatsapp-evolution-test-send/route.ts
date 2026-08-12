import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import {
  findEvolutionHubByConnectionId,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    connection_id?: string
    to?: string
    text?: string
  } | null
  const to = String(body?.to || '').trim()
  const connectionId = String(body?.connection_id || '').trim()

  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'connection_id_required' }, { status: 400 })
  }

  const hub = await findEvolutionHubByConnectionId(
    auth.supabase,
    connectionId,
    auth.organizationId,
  )
  if (!hub) {
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
  }

  const meta = hub.metadata
  const instanceName = String(meta.instance_name || '').trim()
  const apiKey = resolveEvolutionApiKey(hub.access_token)
  const baseUrl = resolveEvolutionApiBaseUrl(meta)

  const { data: orgRow } = await auth.supabase
    .from('organizations')
    .select('name')
    .eq('id', auth.organizationId)
    .maybeSingle()

  const brand = String(orgRow?.name || '').trim()
  const defaultTestText = brand
    ? `Teste ${brand} — Evolution API OK.`
    : 'Teste Evolution API OK.'

  const text = String(body?.text || defaultTestText).trim()

  if (!to) {
    return NextResponse.json({ ok: false, error: 'to_required' }, { status: 400 })
  }
  if (!instanceName || !apiKey || !baseUrl) {
    return NextResponse.json({ ok: false, error: 'whatsapp_evolution_not_configured' }, { status: 400 })
  }

  const result = await sendEvolutionTextMessage({
    baseUrl,
    apiKey,
    instanceName,
    toTarget: to,
    body: text,
  })

  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: 'send_failed', detail: result.error },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, message_id: result.messageId ?? null })
}
