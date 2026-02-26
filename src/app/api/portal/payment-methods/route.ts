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

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .select('id, description, type, fee_percent, credit_installment_fees, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paymentMethods: data ?? [] })
}
