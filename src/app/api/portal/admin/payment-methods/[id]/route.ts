import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

const VALID_TYPES = new Set(['dinheiro', 'pix_direto', 'pix_maquina', 'credito', 'debito'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const description = body?.description != null ? String(body.description).trim() : undefined
  const type = body?.type != null ? String(body.type).trim() : undefined
  const feePercent = body?.fee_percent
  const creditInstallmentFees = body?.credit_installment_fees
  const contaId = body?.conta_id

  if (type != null && !VALID_TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (description !== undefined) update.description = description
  if (type !== undefined) update.type = type
  if (feePercent !== undefined && Number.isFinite(Number(feePercent))) {
    update.fee_percent = Number(feePercent)
  }
  if (contaId !== undefined) {
    update.conta_id = contaId === null ? null : String(contaId)
  }
  if (creditInstallmentFees !== undefined) {
    update.credit_installment_fees = Array.isArray(creditInstallmentFees) ? creditInstallmentFees : []
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .update(update)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paymentMethod: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
