import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { OrdensFilterCollapsible } from './OrdensFilterCollapsible'
import { OrdensListClient } from './OrdensListClient'
import { OrdensToastClient } from './OrdensToastClient'

const OPEN_STATUSES = ['orcamento', 'aguardando_aprovacao', 'aprovado', 'aguardando_pecas', 'em_manutencao', 'aguardando_retirada'] as const
const LIMIT_OPEN = 500

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function isValidOpenStatus(value: string): value is typeof OPEN_STATUSES[number] {
  return OPEN_STATUSES.includes(value as any)
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

type SearchParams = Promise<{
  q?: string
  cpf?: string
  osNumber?: string
  status?: string
  customerId?: string
  customerName?: string
  deviceModelId?: string
  createdFrom?: string
  createdTo?: string
  readyFrom?: string
  readyTo?: string
  noServices?: string
  noCost?: string
  noPayment?: string
  toast?: string
  id?: string
  error?: string
}>

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const {
    q,
    cpf,
    osNumber,
    status,
    customerId,
    customerName,
    deviceModelId,
    createdFrom,
    createdTo,
    readyFrom,
    readyTo,
    noServices,
    noCost,
    noPayment,
    toast,
    id,
    error,
  } = await searchParams
  const query = String(q || '').trim()
  const cpfDigits = normalizeCpf(String(cpf || ''))
  const statusValue = String(status || '').trim()
  const osNumberValue = String(osNumber || '').trim()
  const customerIdValue = String(customerId || '').trim()
  const deviceModelIdValue = String(deviceModelId || '').trim()
  const createdFromValue = isValidDate(createdFrom) ? createdFrom! : ''
  const createdToValue = isValidDate(createdTo) ? createdTo! : ''
  const readyFromValue = isValidDate(readyFrom) ? readyFrom! : ''
  const readyToValue = isValidDate(readyTo) ? readyTo! : ''
  const quickNoServices = String(noServices || '').trim() === '1'
  const quickNoCost = String(noCost || '').trim() === '1'
  const quickNoPayment = String(noPayment || '').trim() === '1'
  const toastType = String(toast || '').trim()
  const toastId = String(id || '').trim()
  const toastError = String(error || '').trim()

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  let customerIdsFilter: string[] | null = null
  if (customerIdValue) {
    customerIdsFilter = [customerIdValue]
  } else if (customerName && customerName.trim().length >= 2) {
    const escaped = String(customerName).trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data: custList } = await supabase
      .from('customers')
      .select('id')
      .or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,trade_name.ilike.%${escaped}%`)
      .limit(100)
    customerIdsFilter = custList && custList.length > 0 ? custList.map((c: { id: string }) => c.id) : []
  } else if (cpfDigits) {
    const { data: custList } = await supabase
      .from('customers')
      .select('id')
      .or(`cpf.eq.${cpfDigits},cnpj.eq.${cpfDigits}`)
    customerIdsFilter = (custList || []).map((c: { id: string }) => c.id)
    if (customerIdsFilter.length === 0) {
      customerIdsFilter = []
    }
  }

  const needsQuickFilterColumns = quickNoServices || quickNoCost || quickNoPayment
  const baseQuery = supabase
    .from('service_orders')
    .select(
      needsQuickFilterColumns
        ? 'id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id, services, services_total_cents, services_cost_total_cents, payment_methods'
        : 'id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id, services, services_total_cents, services_cost_total_cents'
    )
    .in('status', [...OPEN_STATUSES])
    .order('created_at', { ascending: false })
    .limit(LIMIT_OPEN)

  if (query) {
    const escaped = query.replaceAll(',', ' ').trim()
    baseQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  if (customerIdsFilter !== null) {
    if (customerIdsFilter.length === 0) {
      baseQuery.eq('customer_id', '00000000-0000-0000-0000-000000000000')
    } else {
      baseQuery.in('customer_id', customerIdsFilter)
    }
  }

  if (statusValue && isValidOpenStatus(statusValue)) {
    baseQuery.eq('status', statusValue)
  }

  if (osNumberValue) {
    const displayNum = Number.parseInt(osNumberValue, 10)
    if (!Number.isNaN(displayNum)) {
      baseQuery.eq('display_number', displayNum)
    }
  }

  if (deviceModelIdValue) {
    baseQuery.eq('device_model_id', deviceModelIdValue)
  }

  if (createdFromValue) {
    baseQuery.gte('created_at', `${createdFromValue}T00:00:00.000Z`)
  }
  if (createdToValue) {
    baseQuery.lte('created_at', `${createdToValue}T23:59:59.999Z`)
  }
  if (readyFromValue) {
    baseQuery.gte('estimated_ready_at', `${readyFromValue}T00:00:00.000Z`)
  }
  if (readyToValue) {
    baseQuery.lte('estimated_ready_at', `${readyToValue}T23:59:59.999Z`)
  }

  const { data: rawOrders } = await baseQuery

  let ordersList = rawOrders || []
  if (needsQuickFilterColumns && ordersList.length > 0) {
    ordersList = ordersList.filter((o: any) => {
      if (quickNoServices) {
        const svc = o.services
        const hasServices = Array.isArray(svc) && svc.length > 0
        if (hasServices) return false
      }
      if (quickNoCost) {
        const cost = o.services_cost_total_cents
        if (cost != null && Number(cost) > 0) return false
      }
      if (quickNoPayment) {
        const pm = o.payment_methods
        const hasPayment = Array.isArray(pm) && pm.length > 0
        if (hasPayment) return false
      }
      return true
    })
  }
  const customerIds = [...new Set(ordersList.map((o: any) => o.customer_id).filter(Boolean))]
  const deviceModelIds = [...new Set(ordersList.map((o: any) => o.device_model_id).filter(Boolean))]

  let customersMap: Record<string, any> = {}
  let deviceModelsMap: Record<string, any> = {}

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, cpf, cnpj, is_company, full_name, company_name, email, mobile_phone')
      .in('id', customerIds)
    customersMap = (customers || []).reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = c
      return acc
    }, {})
  }

  if (deviceModelIds.length > 0) {
    const { data: deviceModels } = await supabase
      .from('device_models')
      .select('id, model, device_types ( name, device_brands ( name ) )')
      .in('id', deviceModelIds)
    deviceModelsMap = (deviceModels || []).reduce((acc: Record<string, any>, d: any) => {
      const dt = (d as any).device_types || null
      const brandRow = dt?.device_brands || null
      acc[d.id] = {
        id: d.id,
        brand: brandRow?.name ?? null,
        device_type: dt?.name ?? null,
        model: d.model ?? null,
      }
      return acc
    }, {})
  }

  const ordersWithRelations = ordersList.map((o: any) => ({
    ...o,
    customers: o.customer_id ? customersMap[o.customer_id] ?? null : null,
    device_models: o.device_model_id ? deviceModelsMap[o.device_model_id] ?? null : null,
  }))

  const openOrdersByStatus: Record<string, typeof ordersWithRelations> = {}
  for (const s of OPEN_STATUSES) {
    openOrdersByStatus[s] = ordersWithRelations.filter((o: any) => o.status === s)
  }

  const { data: deviceModelsRaw } = await supabase
    .from('device_models')
    .select('id, model, device_types ( name, device_brands ( name ) )')
    .order('model', { ascending: true })
    .limit(500)

  const deviceModels = (deviceModelsRaw || []).map((d: any) => {
    const dt = Array.isArray(d.device_types) ? d.device_types[0] : d.device_types
    const brandRow = dt && (Array.isArray(dt.device_brands) ? dt.device_brands[0] : dt.device_brands)
    return {
      id: d.id,
      brand: brandRow?.name ?? null,
      device_type: dt?.name ?? null,
      model: d.model ?? null,
    }
  })

  const hasFilters = Boolean(
    query || cpfDigits || osNumberValue || statusValue ||
    customerIdValue || customerName || deviceModelIdValue ||
    createdFromValue || createdToValue || readyFromValue || readyToValue ||
    quickNoServices || quickNoCost || quickNoPayment
  )

  return (
    <div className="space-y-6">
      <OrdensToastClient />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">
            Área interna (staff/admin).
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/ordens/nova">Nova ordem</Link>
        </Button>
      </div>

      <OrdensFilterCollapsible
        defaultOpen={hasFilters}
        initialValues={{
          q: query,
          cpf: cpfDigits,
          osNumber: osNumberValue,
          status: statusValue,
          customerName: String(customerName || '').trim(),
          customerId: customerIdValue,
          deviceModelId: deviceModelIdValue,
          createdFrom: createdFromValue,
          createdTo: createdToValue,
          readyFrom: readyFromValue,
          readyTo: readyToValue,
          noServices: quickNoServices ? '1' : '',
          noCost: quickNoCost ? '1' : '',
          noPayment: quickNoPayment ? '1' : '',
        }}
        deviceModels={deviceModels}
      />

      <OrdensListClient
        openOrdersByStatus={openOrdersByStatus}
        filterQ={query}
        filterCpf={cpfDigits}
        filterOsNumber={osNumberValue}
        filterStatus={statusValue}
        filterCustomerId={customerIdValue}
        filterCustomerName={String(customerName || '').trim()}
        filterDeviceModelId={deviceModelIdValue}
        filterCreatedFrom={createdFromValue}
        filterCreatedTo={createdToValue}
        filterReadyFrom={readyFromValue}
        filterReadyTo={readyToValue}
        canDelete={role === 'admin'}
      />
    </div>
  )
}

