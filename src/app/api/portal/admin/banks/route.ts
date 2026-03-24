import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('contas')
    .select('id, name, saldo_inicial_cents, created_at')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, contas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const name = String(body?.name ?? '').trim()
  const saldoInicialCents = body?.saldo_inicial_cents != null ? Number(body.saldo_inicial_cents) : 0
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('contas')
    .insert({ name, saldo_inicial_cents: Number.isFinite(saldoInicialCents) ? saldoInicialCents : 0 })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conta: data })
}
