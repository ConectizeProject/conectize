import { NextResponse } from 'next/server'
import { requireRealAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { processBlingWebhook } from '@/lib/integrations/bling/webhook-service'

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRealAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const webhookId = parseOptionalUuid(rawId)
  if (!webhookId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from('integration_webhooks')
    .select('id, platform_id')
    .eq('id', webhookId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (String(existing.platform_id || '') !== 'bling') {
    return NextResponse.json(
      { ok: false, error: 'unsupported_platform' },
      { status: 400 },
    )
  }

  const result = await processBlingWebhook(webhookId)
  switch (result.ok) {
    case true:
      return NextResponse.json({ ok: true, status: result.status })
    case false:
      return NextResponse.json(
        { ok: false, error: 'process_failed', error_message: result.error_message },
        { status: 200 },
      )
    default: {
      const _exhaustive: never = result
      return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 })
    }
  }
}

