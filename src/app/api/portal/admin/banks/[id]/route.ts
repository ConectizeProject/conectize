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
  const name = body?.name != null ? String(body.name).trim() : undefined
  const saldoInicialCents = body?.saldo_inicial_cents
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) update.name = name
  if (saldoInicialCents !== undefined && Number.isFinite(Number(saldoInicialCents))) {
    update.saldo_inicial_cents = Number(saldoInicialCents)
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: 'name_or_saldo_inicial_required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('contas')
    .update(update)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conta: data })
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

  const { data: conta } = await auth.supabase
    .from('contas')
    .select('id')
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!conta) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  await auth.supabase
    .from('payment_methods')
    .update({ conta_id: null })
    .eq('conta_id', id)
    .eq('organization_id', auth.organizationId)

  await auth.supabase
    .from('recurring_expenses')
    .update({ is_active: false, updated_at: now })
    .eq('conta_id', id)
    .eq('organization_id', auth.organizationId)

  const { error } = await auth.supabase
    .from('contas')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
