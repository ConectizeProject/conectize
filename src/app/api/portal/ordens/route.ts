import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { listFinalOrdersWithRelations } from '@/lib/portal/list-final-orders-with-relations'
import { portalOrdensFinalListResponseSchema } from '@/lib/portal/portal-ordens-api-schemas'

export async function GET(request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')?.trim()
  const countOnly = searchParams.get('countOnly') === '1' || searchParams.get('countOnly') === 'true'
  const statusGroup = searchParams.get('statusGroup')?.trim()
  const q = searchParams.get('q')?.trim() ?? ''
  const cpf = (searchParams.get('cpf') ?? '').replace(/\D/g, '').trim()
  const osNumber = searchParams.get('osNumber')?.trim() ?? ''
  const statusFilter = searchParams.get('status')?.trim() ?? ''
  const filterCustomerId = searchParams.get('customerId')?.trim() ?? ''
  const filterCustomerName = searchParams.get('customerName')?.trim() ?? ''
  const filterDeviceModelId = searchParams.get('deviceModelId')?.trim() ?? ''
  const filterCreatedFrom = searchParams.get('createdFrom')?.trim() ?? ''
  const filterCreatedTo = searchParams.get('createdTo')?.trim() ?? ''
  const filterReadyFrom = searchParams.get('readyFrom')?.trim() ?? ''
  const filterReadyTo = searchParams.get('readyTo')?.trim() ?? ''

  if (statusGroup === 'final') {
    const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const rawOffset = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : undefined
    const offset =
      Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : undefined

    const { orders, hasMore, error } = await listFinalOrdersWithRelations(
      auth.supabase,
      {
        q,
        cpf,
        osNumber,
        statusFilter,
        filterCustomerId,
        filterCustomerName,
        filterDeviceModelId,
        filterCreatedFrom,
        filterCreatedTo,
        filterReadyFrom,
        filterReadyTo,
      },
      { limit, offset },
    )
    if (error) {
      console.error('[portal/ordens] list final error:', error)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    const payload = { ok: true as const, orders, hasMore }
    const parsed = portalOrdensFinalListResponseSchema.safeParse(payload)
    if (!parsed.success) {
      console.error('[portal/ordens] final list response schema', parsed.error.flatten())
      return NextResponse.json({ ok: false, error: 'response_invalid' }, { status: 500 })
    }
    return NextResponse.json(parsed.data)
  }

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
