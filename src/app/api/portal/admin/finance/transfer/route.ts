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
  const fromContaId = body?.from_conta_id ?? null
  const toContaId = body?.to_conta_id ?? null
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : null
  const description = body?.description != null ? String(body.description).trim() : 'Transferência entre contas'

  if (!fromContaId || typeof fromContaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'from_conta_id_required' }, { status: 400 })
  }
  if (!toContaId || typeof toContaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'to_conta_id_required' }, { status: 400 })
  }
  if (fromContaId === toContaId) {
    return NextResponse.json({ ok: false, error: 'same_conta' }, { status: 400 })
  }
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  const transferId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const today = new Date().toISOString().slice(0, 10)

  const { data: inserted, error } = await auth.supabase
    .from('financial_transactions')
    .insert([
      {
        conta_id: fromContaId,
        amount_cents: -amountCents,
        type: 'transferencia',
        description: description || 'Transferência (origem)',
        occurred_at: today,
        transfer_id: transferId,
      },
      {
        conta_id: toContaId,
        amount_cents: amountCents,
        type: 'transferencia',
        description: description || 'Transferência (destino)',
        occurred_at: today,
        transfer_id: transferId,
      },
    ])
    .select()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transfer_id: transferId, transactions: inserted })
}
