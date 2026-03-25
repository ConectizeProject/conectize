import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin, requireAdmin } from '@/lib/auth/portal-api'
import { applyOrderStatusChange } from '@/lib/orders/apply-order-status-change'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { ORDER_STATUS_SET } from '@/lib/orders/order-status'

/**
 * API REST para integrações / clientes que não usam Server Actions.
 * Lógica compartilhada com `updateOrderStatusAction` em `order-detail-actions.ts`
 * (`applyOrderStatusChange`).
 */
export async function PATCH (
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

  const body = await request.json().catch(() => null)
  const status = typeof body === 'object' && body && 'status' in body
    ? String((body as { status: unknown }).status ?? '').trim()
    : ''

  if (!status || !ORDER_STATUS_SET.has(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const result = await applyOrderStatusChange(auth.supabase, {
    orderId,
    nextStatus: status,
    editorUserId: auth.userId,
  })

  if (result.ok === false) {
    const err = result.error
    if (err === 'not_found') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (err === 'invalid_status') {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { error } = await auth.supabase.from('service_orders').delete().eq('id', orderId)

  if (error) {
    console.error('[ordens DELETE]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
