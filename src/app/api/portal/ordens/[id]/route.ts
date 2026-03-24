import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin, requireAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildOrderEditDiff } from '@/lib/orders/order-edit-history'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'

const VALID_STATUSES = new Set([
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
  'cancelada',
])

const FINALIZED_STATUSES = new Set([
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
  'cancelada',
])

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

  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await auth.supabase
    .from('service_orders')
    .select('status, services, closed_at')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const previousStatus = String(existing.status || '')
  const updatePayload: Record<string, unknown> = { status }
  if (FINALIZED_STATUSES.has(status)) {
    updatePayload.closed_at = new Date().toISOString()
  }

  const { error: upErr } = await auth.supabase
    .from('service_orders')
    .update(updatePayload)
    .eq('id', orderId)

  if (upErr) {
    console.error('[ordens PATCH]', upErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const diffRows = buildOrderEditDiff(existing as Record<string, unknown>, updatePayload)
  if (diffRows.length > 0) {
    const editedAt = new Date().toISOString()
    const { error: histErr } = await auth.supabase
      .from('service_order_edit_history')
      .insert(
        diffRows.map((r) => ({
          service_order_id: orderId,
          edited_by: auth.userId,
          edited_at: editedAt,
          field_key: r.field_key,
          old_value: r.old_value,
          new_value: r.new_value,
        })),
      )
    if (histErr) {
      console.error('[ordens PATCH edit-history]', histErr)
    }
  }

  try {
    await applyOrderStatusStockTransition({
      supabase: auth.supabase,
      orderId,
      previousStatus,
      nextStatus: status,
      services: existing.services,
      actorUserId: auth.userId,
    })
  } catch (err) {
    console.error('[ordens PATCH stock]', err)
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
