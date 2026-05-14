import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function cleanText (value: unknown): string {
  return String(value ?? '').trim()
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
  const deviceId = parseOptionalUuid(rawId)
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const valueRaw = (body as { value_cents?: unknown }).value_cents
  const value_cents =
    typeof valueRaw === 'number' && Number.isFinite(valueRaw)
      ? Math.round(valueRaw)
      : 0

  const { data: inserted, error } = await auth.supabase
    .from('resale_device_costs')
    .insert({
      organization_id: auth.organizationId,
      resale_device_id: deviceId,
      description: cleanText((body as { description?: unknown }).description) || null,
      value_cents,
    })
    .select('id, description, value_cents')
    .single()

  if (error) {
    console.error('[resale-device-costs POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cost: inserted })
}
