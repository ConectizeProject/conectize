import { after, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, getBlingResourceKeyFromWebhook } from '@/lib/integrations/bling/webhooks'
import crypto from 'crypto'

const PLATFORM_ID = 'bling'

function verifyBlingSignature (rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.BLING_WEBHOOK_SECRET ?? process.env.BLING_CLIENT_SECRET
  if (!secret || !signatureHeader) return false
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex')
    const match = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase()
    if (!/^[0-9a-f]+$/.test(match) || match.length !== expected.length) return false
    return crypto.timingSafeEqual(
      Buffer.from(match, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}

function extractCompanyId (payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as Record<string, unknown>
  const raw = root.companyId ?? root.company_id ?? root.idEmpresa ?? root.empresaId
  const text = String(raw ?? '').trim()
  return text || null
}

async function resolveOrganizationId (
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string | null,
): Promise<string | null> {
  if (companyId) {
    const { data: byEmpresa } = await supabase
      .from('hub_connections')
      .select('organization_id, metadata')
      .eq('platform_id', PLATFORM_ID)
      .order('updated_at', { ascending: false })
      .limit(50)

    for (const row of byEmpresa || []) {
      const meta = row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null
      const empresaId = String(meta?.empresaId ?? meta?.companyId ?? '').trim()
      if (empresaId && empresaId === companyId && row.organization_id) {
        return String(row.organization_id)
      }
    }
  }

  const { data: blingConn } = await supabase
    .from('hub_connections')
    .select('organization_id')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return blingConn?.organization_id ? String(blingConn.organization_id) : null
}

export async function POST (request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const signatureHeader = request.headers.get('x-bling-signature-256') ?? request.headers.get('X-Bling-Signature-256')
  if (process.env.BLING_WEBHOOK_SECRET || process.env.BLING_CLIENT_SECRET) {
    if (!verifyBlingSignature(rawBody, signatureHeader)) {
      console.warn('[bling webhook] invalid_signature', {
        hasHeader: Boolean(signatureHeader),
        bodyBytes: rawBody.length,
      })
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  let payload: unknown
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseBlingWebhook(payload)
  const eventType = parsed.kind === 'unknown' ? parsed.eventType : (parsed.eventType || 'unknown')
  const externalId = getBlingResourceKeyFromWebhook(parsed)
  const companyId = extractCompanyId(payload)

  const supabase = createSupabaseServiceClient()
  const organizationId = await resolveOrganizationId(supabase, companyId)
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_context_missing' }, { status: 409 })
  }

  const { data: row, error } = await supabase
    .from('integration_webhooks')
    .insert({
      organization_id: organizationId,
      platform_id: PLATFORM_ID,
      event_type: eventType,
      external_id: externalId,
      payload,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !row) {
    console.error('[bling webhook] insert error', {
      platformId: PLATFORM_ID,
      eventType,
      externalId,
      companyId,
      message: error?.message ?? null,
      details: error?.details ?? null,
      code: error?.code ?? null,
    })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const webhookId = String(row.id)
  // Bling exige HTTP 2xx em até ~5s. Processamos depois da resposta.
  after(async () => {
    try {
      const { processBlingWebhook } = await import('@/lib/integrations/bling/webhook-service')
      await processBlingWebhook(webhookId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      console.error('[bling webhook] process error', { id: webhookId, message })
    }
  })

  return NextResponse.json({ ok: true, id: webhookId }, { status: 200 })
}
