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

  const FINAL_STATUSES = ['finalizada', 'finalizada_sem_conserto', 'finalizada_sem_aprovacao', 'cancelada']
  const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

  if (statusGroup === 'final') {
    let customerIdsFilter: string[] | null = null
    if (filterCustomerId) {
      customerIdsFilter = [filterCustomerId]
    } else if (filterCustomerName && filterCustomerName.length >= 2) {
      const escaped = filterCustomerName.replace(/%/g, '\\%').replace(/_/g, '\\_')
      const { data: custList } = await auth.supabase
        .from('customers')
        .select('id')
        .or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,trade_name.ilike.%${escaped}%`)
        .limit(100)
      customerIdsFilter = custList && custList.length > 0 ? custList.map((c: { id: string }) => c.id) : []
    } else if (cpf) {
      const { data: custList } = await auth.supabase
        .from('customers')
        .select('id')
        .or(`cpf.eq.${cpf},cnpj.eq.${cpf}`)
      customerIdsFilter = (custList || []).map((c: { id: string }) => c.id)
      if (customerIdsFilter.length === 0) {
        return NextResponse.json({ ok: true, orders: [] })
      }
    }

    const baseQuery = auth.supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id')
      .in('status', FINAL_STATUSES)
      .order('created_at', { ascending: false })
      .limit(500)

    if (q) {
      const escaped = q.replaceAll(',', ' ').trim()
      baseQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
    }
    if (osNumber) {
      const displayNum = Number.parseInt(osNumber, 10)
      if (!Number.isNaN(displayNum)) {
        baseQuery.eq('display_number', displayNum)
      }
    }
    if (statusFilter && FINAL_STATUSES.includes(statusFilter)) {
      baseQuery.eq('status', statusFilter)
    }
    if (customerIdsFilter !== null) {
      if (customerIdsFilter.length === 0) {
        baseQuery.eq('customer_id', '00000000-0000-0000-0000-000000000000')
      } else {
        baseQuery.in('customer_id', customerIdsFilter)
      }
    }
    if (filterDeviceModelId) baseQuery.eq('device_model_id', filterDeviceModelId)
    if (filterCreatedFrom && isValidDate(filterCreatedFrom)) {
      baseQuery.gte('created_at', `${filterCreatedFrom}T00:00:00.000Z`)
    }
    if (filterCreatedTo && isValidDate(filterCreatedTo)) {
      baseQuery.lte('created_at', `${filterCreatedTo}T23:59:59.999Z`)
    }
    if (filterReadyFrom && isValidDate(filterReadyFrom)) {
      baseQuery.gte('estimated_ready_at', `${filterReadyFrom}T00:00:00.000Z`)
    }
    if (filterReadyTo && isValidDate(filterReadyTo)) {
      baseQuery.lte('estimated_ready_at', `${filterReadyTo}T23:59:59.999Z`)
    }

    const { data: ordersList, error } = await baseQuery
    if (error) {
      console.error('[portal/ordens] list final error:', error)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const list = ordersList ?? []
    const customerIds = [...new Set(list.map((o: any) => o.customer_id).filter(Boolean))]
    const deviceModelIds = [...new Set(list.map((o: any) => o.device_model_id).filter(Boolean))]

    let customersMap: Record<string, any> = {}
    let deviceModelsMap: Record<string, any> = {}

    if (customerIds.length > 0) {
      const { data: customers } = await auth.supabase
        .from('customers')
        .select('id, cpf, cnpj, is_company, full_name, company_name, email, mobile_phone')
        .in('id', customerIds)
      customersMap = (customers || []).reduce((acc: Record<string, any>, c: any) => {
        acc[c.id] = c
        return acc
      }, {})
    }
    if (deviceModelIds.length > 0) {
      const { data: deviceModels } = await auth.supabase
        .from('device_models')
        .select('id, brand, device_type, model')
        .in('id', deviceModelIds)
      deviceModelsMap = (deviceModels || []).reduce((acc: Record<string, any>, d: any) => {
        acc[d.id] = d
        return acc
      }, {})
    }

    const orders = list.map((o: any) => ({
      ...o,
      customers: o.customer_id ? customersMap[o.customer_id] ?? null : null,
      device_models: o.device_model_id ? deviceModelsMap[o.device_model_id] ?? null : null,
    }))

    return NextResponse.json({ ok: true, orders })
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
