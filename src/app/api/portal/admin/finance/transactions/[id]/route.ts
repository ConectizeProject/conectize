import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : undefined
  const contaId = body?.conta_id
  const description = body?.description !== undefined ? String(body.description).trim() : undefined
  const occurredAt = body?.occurred_at

  const { data: existing } = await auth.supabase
    .from('financial_transactions')
    .select('id, type, transfer_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if ((existing as { transfer_id?: string }).transfer_id) {
    return NextResponse.json({ ok: false, error: 'cannot_edit_transfer' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (description !== undefined) update.description = description
  if (occurredAt !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(occurredAt))) {
    update.occurred_at = occurredAt
  }
  if (contaId !== undefined && typeof contaId === 'string') update.conta_id = contaId
  if (amountCents !== undefined && Number.isFinite(amountCents) && amountCents > 0) {
    const type = (existing as { type: string }).type
    update.amount_cents = type === 'entrada' ? amountCents : -amountCents
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, transaction: existing })
  }

  const { data, error } = await auth.supabase
    .from('financial_transactions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { data: existing } = await auth.supabase
    .from('financial_transactions')
    .select('transfer_id')
    .eq('id', id)
    .maybeSingle()

  if (existing && (existing as { transfer_id?: string }).transfer_id) {
    return NextResponse.json({ ok: false, error: 'cannot_delete_transfer' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('financial_transactions')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
