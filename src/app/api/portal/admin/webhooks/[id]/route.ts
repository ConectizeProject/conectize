import { NextResponse } from 'next/server'
import { requireRealAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function GET (
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

  const { data, error } = await auth.supabase
    .from('integration_webhooks')
    .select('id, platform_id, event_type, external_id, status, error_message, retry_count, processed_at, created_at, payload')
    .eq('id', webhookId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, webhook: data })
}
