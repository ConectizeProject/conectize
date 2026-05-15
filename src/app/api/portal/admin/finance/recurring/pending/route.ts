import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  mapRecurringRowsToPending,
  recurringInvoiceVisibleInShortList,
  type RecurringRowInput,
} from '@/lib/finance/recurring-due'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('recurring_expenses')
    .select('id, description, amount_cents, conta_id, billing_day, is_active, last_generated_for, contas(name)')
    .order('description', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const rows = (data ?? []) as RecurringRowInput[]
  const today = new Date()
  const pending = mapRecurringRowsToPending(rows, today).filter((p) =>
    recurringInvoiceVisibleInShortList(p, today)
  )

  return NextResponse.json({ ok: true, pending })
}
