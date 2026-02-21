import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')?.trim()
  const countOnly = searchParams.get('countOnly') === '1' || searchParams.get('countOnly') === 'true'

  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'customerId_required' }, { status: 400 })
  }

  if (countOnly) {
    const { count, error: countError } = await auth.supabase
      .from('service_orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)

    if (countError) {
      console.error('[portal/ordens] count by customer error:', countError)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: count ?? 0 })
  }

  const { data: orders, error } = await auth.supabase
    .from('service_orders')
    .select('id, display_number, status, title, created_at, updated_at, estimated_ready_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[portal/ordens] list by customer error:', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, orders: orders ?? [] })
}
