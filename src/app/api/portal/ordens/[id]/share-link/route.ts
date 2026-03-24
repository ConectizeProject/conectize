import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { requestOriginFromNext } from '@/lib/orders/fetch-order-for-print-html'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: row, error } = await auth.supabase
    .from('service_orders')
    .select('share_token')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[share-link]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let token = row.share_token as string | null
  if (!token) {
    token = randomUUID()
    const { error: upErr } = await auth.supabase
      .from('service_orders')
      .update({ share_token: token })
      .eq('id', orderId)
    if (upErr) {
      console.error('[share-link]', upErr)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
  }

  const origin = requestOriginFromNext(request)
  const url = `${origin}/os/${token}`
  return NextResponse.json({ ok: true, url })
}
