import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const fromDate = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : null
  const toDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : null

  let query = auth.supabase
    .from('financial_transactions')
    .select('id, conta_id, amount_cents, type, description, occurred_at, created_at, transfer_id, recurring_expense_id, service_order_id, resale_device_id, contas(name)')
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (fromDate) query = query.gte('occurred_at', fromDate)
  if (toDate) query = query.lte('occurred_at', toDate)

  const { data: transactions, error: txError } = await query

  if (txError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const contaIds = new Set<string>()
  for (const t of transactions ?? []) {
    const cid = (t as { conta_id?: string }).conta_id
    if (cid) contaIds.add(cid)
  }

  const contaNameMap: Record<string, string> = {}
  if (contaIds.size > 0) {
    const { data: contasList } = await auth.supabase
      .from('contas')
      .select('id, name')
      .in('id', Array.from(contaIds))
    for (const c of contasList ?? []) {
      contaNameMap[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name
    }
  }

  const merged = (transactions ?? []).map((t: Record<string, unknown>) => {
    const contaId = t.conta_id as string
    const conta = t.contas as { name?: string } | null
    const serviceOrderId = t.service_order_id as string | null
    const resaleDeviceId = t.resale_device_id as string | null
    const source = serviceOrderId ? 'os' : resaleDeviceId ? 'seminovo' : 'transaction'
    const editable = !serviceOrderId && !resaleDeviceId
    return {
      id: t.id,
      source,
      conta_id: contaId,
      conta_name: conta?.name ?? contaNameMap[contaId] ?? '',
      amount_cents: t.amount_cents as number,
      type: t.type as string,
      description: (t.description as string) ?? '',
      occurred_at: t.occurred_at as string,
      created_at: t.created_at as string,
      transfer_id: t.transfer_id ?? null,
      recurring_expense_id: t.recurring_expense_id ?? null,
      service_order_id: serviceOrderId,
      resale_device_id: resaleDeviceId,
      editable,
    }
  }).sort((a, b) => {
    const d = b.occurred_at.localeCompare(a.occurred_at)
    if (d !== 0) return d
    return (b.created_at || '').localeCompare(a.created_at || '')
  })

  return NextResponse.json({ ok: true, movements: merged })
}
