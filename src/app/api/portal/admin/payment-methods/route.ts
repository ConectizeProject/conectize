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

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paymentMethods: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const description = String(body?.description || '').trim()
  const type = String(body?.type || '').trim()
  const feePercent = body?.fee_percent != null ? Number(body.fee_percent) : 0
  const creditInstallmentFees = Array.isArray(body?.credit_installment_fees)
    ? body.credit_installment_fees
    : []

  if (!description) {
    return NextResponse.json({ ok: false, error: 'description_required' }, { status: 400 })
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
  }

  const { data: maxSort } = await auth.supabase
    .from('payment_methods')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (maxSort?.sort_order ?? -1) + 1

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .insert({
      description,
      type,
      fee_percent: feePercent,
      credit_installment_fees: type === 'credito' ? creditInstallmentFees : [],
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paymentMethod: data })
}
