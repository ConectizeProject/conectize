import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const reason = String(body?.reason || '').trim() || null

  const { error } = await auth.supabase
    .from('pos_sales')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_by: auth.userId,
      cancel_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

