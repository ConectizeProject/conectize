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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const type = String(body?.type ?? '').trim()
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : null
  const contaId = body?.conta_id ?? null
  const description = body?.description != null ? String(body.description).trim() : ''
  const occurredAt = body?.occurred_at ?? null

  if (type !== 'entrada' && type !== 'saida') {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
  }
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }
  if (!contaId || typeof contaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'conta_id_required' }, { status: 400 })
  }

  const signed = type === 'entrada' ? amountCents : -amountCents
  const dateStr = occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(String(occurredAt)) ? String(occurredAt) : new Date().toISOString().slice(0, 10)

  const { data, error } = await auth.supabase
    .from('financial_transactions')
    .insert({
      conta_id: contaId,
      amount_cents: signed,
      type,
      description: description || null,
      occurred_at: dateStr,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction: data })
}
