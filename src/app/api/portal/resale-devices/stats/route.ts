import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' as const }
  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = appUser?.role || 'user'
  if (role !== 'admin' && role !== 'staff') {
    return { ok: false as const, status: 403, error: 'forbidden' as const }
  }
  return { ok: true as const, supabase }
}

export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const startDate = `${year}-${month}-01`
  const nextMonth = new Date(year, now.getMonth() + 1, 1)
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const { data: soldDevices, error } = await auth.supabase
    .from('resale_devices')
    .select('sold_for_cents, actual_profit_cents')
    .eq('sold', true)
    .gte('sale_date', startDate)
    .lt('sale_date', endDate)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const list = soldDevices || []
  const soldThisMonthCount = list.length
  const soldThisMonthCents = list.reduce((acc, d) => acc + (d.sold_for_cents ?? 0), 0)
  const profitThisMonthCents = list.reduce((acc, d) => acc + (d.actual_profit_cents ?? 0), 0)

  return NextResponse.json({
    ok: true,
    stats: {
      soldThisMonthCount,
      soldThisMonthCents,
      profitThisMonthCents,
    },
  })
}
