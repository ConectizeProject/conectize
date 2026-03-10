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
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conta: data })
}
