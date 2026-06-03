import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body?.description !== undefined) update.description = String(body.description).trim()
  if (body?.amount_cents !== undefined) {
    const n = Number(body.amount_cents)
    if (Number.isFinite(n) && n > 0) update.amount_cents = n
  }
  if (body?.conta_id !== undefined) update.conta_id = body.conta_id
  if (body?.billing_day !== undefined) {
    const d = Number(body.billing_day)
    if (Number.isInteger(d) && d >= 1 && d <= 31) update.billing_day = d
  }
  if (body?.is_active !== undefined) update.is_active = Boolean(body.is_active)

  const { data, error } = await auth.supabase
    .from('recurring_expenses')
    .update(update)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recurring: data })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
