import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  loadSalesChartsSummary,
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

  const charts = await loadSalesChartsSummary({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
  })

  return NextResponse.json({
    ok: true,
    ...charts,
  })
}
