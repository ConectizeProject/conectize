import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('recurring_expenses')
    .select('id, description, amount_cents, conta_id, billing_day, is_active, last_generated_for, created_at, contas(name)')
    .order('description', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recurring: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const description = String(body?.description ?? '').trim()
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : null
  const contaId = body?.conta_id ?? null
  const billingDay = body?.billing_day != null ? Number(body.billing_day) : null

  if (!description) {
    return NextResponse.json({ ok: false, error: 'description_required' }, { status: 400 })
  }
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }
  if (!contaId || typeof contaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'conta_id_required' }, { status: 400 })
  }
  if (billingDay === null || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
    return NextResponse.json({ ok: false, error: 'invalid_billing_day' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('recurring_expenses')
    .insert({
      organization_id: auth.organizationId,
      description,
      amount_cents: amountCents,
      conta_id: contaId,
      billing_day: billingDay,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recurring: data })
}
