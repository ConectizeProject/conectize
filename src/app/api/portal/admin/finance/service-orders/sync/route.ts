import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { backfillServiceOrderFinancialTransactionsByOrganization } from '@/lib/finance/service-order-financial-sync'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  try {
    const result = await backfillServiceOrderFinancialTransactionsByOrganization({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      pageSize: 200,
      fromDate,
      toDate,
    })
    return NextResponse.json({
      ok: true,
      syncedOrders: result.syncedOrders,
      syncedResaleDevices: result.syncedResaleDevices,
      syncedPdvSales: result.syncedPdvSales,
    })
  } catch (err) {
    console.error('[finance-service-orders-sync]', err)
    return NextResponse.json({ ok: false, error: 'sync_failed' }, { status: 500 })
  }
}
