import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawOrderId, historyId: rawHistoryId } = await params
  const orderId = parseOptionalUuid(rawOrderId)
  const historyId = parseOptionalUuid(rawHistoryId)
  if (!orderId || !historyId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('service_order_edit_history')
    .delete()
    .eq('id', historyId)
    .eq('service_order_id', orderId)
    .select('id')

  if (error) {
    console.error('[edit-history-delete]', error)
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  }

  if (!data?.length) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
