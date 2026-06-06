import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

type Params = Promise<{ id: string }>

async function loadEditableTransaction (
  id: string,
  organizationId: string,
  supabase: any,
) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, amount_cents, service_order_id, resale_device_id, transfer_id, description')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error || !data) return { ok: false as const, error: 'not_found' as const }
  const row = data as {
    id: string
    amount_cents: number
    service_order_id?: string | null
    resale_device_id?: string | null
    transfer_id?: string | null
    description?: string | null
  }
  const isPdvFinancial = /^PDV:[0-9a-fA-F-]{36}:/.test(String(row.description || ''))
  if (row.service_order_id || row.resale_device_id || row.transfer_id || isPdvFinancial) {
    return { ok: false as const, error: 'not_editable' as const }
  }
  return { ok: true as const, row }
}

export async function PATCH (
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const current = await loadEditableTransaction(id, auth.organizationId, auth.supabase)
  if (!current.ok) {
    const status = current.error === 'not_found' ? 404 : 400
    return NextResponse.json({ ok: false, error: current.error }, { status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : null
  const typeRaw = String(body?.type ?? '').trim()
  const nextType = typeRaw === 'entrada' || typeRaw === 'saida' ? typeRaw : null
  const contaId = typeof body?.conta_id === 'string' ? body.conta_id : null
  const description = body?.description != null ? String(body.description).trim() : ''
  const occurredAt = body?.occurred_at

  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }
  if (!contaId) {
    return NextResponse.json({ ok: false, error: 'conta_id_required' }, { status: 400 })
  }

  const absAmount = Math.abs(Math.round(amountCents))
  const nextSigned = nextType === 'saida'
    ? -absAmount
    : nextType === 'entrada'
      ? absAmount
      : (current.row.amount_cents >= 0 ? absAmount : -absAmount)
  const dateStr = occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(String(occurredAt))
    ? String(occurredAt)
    : new Date().toISOString().slice(0, 10)

  const patch: Record<string, unknown> = {
    conta_id: contaId,
    amount_cents: nextSigned,
    description: description || null,
    occurred_at: dateStr,
  }
  if (nextType) patch.type = nextType

  const { data, error } = await auth.supabase
    .from('financial_transactions')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: error.message } : {}),
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction: data })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const current = await loadEditableTransaction(id, auth.organizationId, auth.supabase)
  if (!current.ok) {
    const status = current.error === 'not_found' ? 404 : 400
    return NextResponse.json({ ok: false, error: current.error }, { status })
  }

  const { error } = await auth.supabase
    .from('financial_transactions')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: error.message } : {}),
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
