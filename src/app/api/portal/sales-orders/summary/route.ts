import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  loadSalesChartsSummary,
  loadSalesShippingBoardSummary,
  scheduleMeliPurchaseDatesBackfill,
} from '@/lib/vendas/sales-orders-summary'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  scheduleMeliPurchaseDatesBackfill({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
  })

  const [charts, board] = await Promise.all([
    loadSalesChartsSummary({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
    }),
    loadSalesShippingBoardSummary({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      lookbackDays: 45,
    }),
  ])

  return NextResponse.json({
    ok: true,
    ...charts,
    ...board,
  })
}
