import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { loadSalesShippingBoardSummary } from '@/lib/vendas/sales-orders-summary'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const board = await loadSalesShippingBoardSummary({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    lookbackDays: 45,
  })

  return NextResponse.json({
    ok: true,
    ...board,
  })
}
