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

const VALID_TYPES = new Set(['dinheiro', 'pix_direto', 'pix_maquina', 'credito', 'debito'])

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
  const description = body?.description != null ? String(body.description).trim() : undefined
  const type = body?.type != null ? String(body.type).trim() : undefined
  const feePercent = body?.fee_percent != null ? Number(body.fee_percent) : undefined
  const creditInstallmentFees = body?.credit_installment_fees

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (description !== undefined) updatePayload.description = description
  if (body?.conta_id !== undefined) updatePayload.conta_id = body.conta_id === null || body.conta_id === '' ? null : body.conta_id
  if (type !== undefined) {
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
    }
    updatePayload.type = type
  }
  if (feePercent !== undefined) updatePayload.fee_percent = feePercent
  if (creditInstallmentFees !== undefined) {
    updatePayload.credit_installment_fees = Array.isArray(creditInstallmentFees)
      ? creditInstallmentFees
      : []
  }

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .update(updatePayload)
    .eq('id', id)
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
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
