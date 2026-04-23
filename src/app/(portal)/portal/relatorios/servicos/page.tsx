import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildRevenueSeries } from '@/lib/reports/revenue-series'
import { RevenueChartTabs } from '@/components/reports/RevenueChartTabs'
import { VendasAparelhosPeriodBar } from '@/components/reports/VendasAparelhosPeriodBar'
import { RelatorioServicosStatusSelect, RelatorioServicosQuickFilter } from '@/components/reports/RelatorioServicosFilters'
import { RelatorioServicosCustomerSelect } from '@/components/reports/RelatorioServicosCustomerSelect'
import { RelatorioServicosList } from '@/components/reports/RelatorioServicosList'
import { RelatorioServicosPdfButton } from '@/components/reports/RelatorioServicosPdfButton'
import { RelatorioServicosSituacao } from '@/components/reports/RelatorioServicosSituacao'
import { maskedFromCents } from '@/lib/utils/money'
import { formatDateBr } from '@/lib/utils/format-date'
import {
  FINALIZED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  isFinalizedOrderStatus,
  isOpenOrderStatus,
} from '@/lib/orders/order-status'
import type { RevenueBucket } from '@/lib/reports/revenue-series'

export const dynamic = 'force-dynamic'

const FINAL_SUCCESS_STATUS = 'finalizada'
const FINAL_NO_FIX_STATUS = 'finalizada_sem_conserto'

type FeeBreakdownItem = { type: string; feePercent: number; valueCents: number; feeCents: number }

type ServiceOrderRow = {
  id: string
  display_number: string | number | null
  status: string
  title: string | null
  created_at: string | null
  closed_at: string | null
  services: unknown
  services_total_cents: number | null
  services_cost_total_cents: number | null
  payment_methods?: unknown
  is_warranty?: boolean | null
  payment_fees_cents?: number
  net_received_cents?: number
  payment_fees_breakdown?: FeeBreakdownItem[]
}

type FaturamentoFiltroKey = 'todos' | 'ambos_zero' | 'custo_zero_com_cobrado'

type SearchParams = Promise<{
  from?: string
  to?: string
  statusGroup?: string
  status?: string | string[]
  customerId?: string
  /** Legado: use faturamentoFiltro=ambos_zero */
  semValores?: string
  faturamentoFiltro?: string
}>

export default async function RelatorioServicosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  if (role !== 'admin' && role !== 'platform_admin') {
    redirect('/portal/dashboard')
  }

  const sp = await searchParams
  const { from, to, statusGroup = '', status, customerId } = sp
  const faturamentoFiltroKey = resolveFaturamentoFiltro(sp)
  const { fromDate, toDate, fromStr, toStr } = getDateRange(from, to)

  const statusArray = Array.isArray(status) ? status.filter(Boolean) : status ? [status].filter(Boolean) : []

  const fetchOpen = statusGroup !== 'closed'
  const fetchClosed = statusGroup !== 'open'

  const openStatuses = statusArray.length > 0
    ? statusArray.filter((s) => isOpenOrderStatus(s))
    : [...OPEN_ORDER_STATUSES]
  const closedStatuses = statusArray.length > 0
    ? statusArray.filter((s) => isFinalizedOrderStatus(s))
    : [...FINALIZED_ORDER_STATUSES]

  const supabase = await createSupabaseServerClient()

  const fromIso = `${fromStr}T00:00:00.000Z`
  const toIso = `${toStr}T23:59:59.999Z`

  const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
  const toDatePrev = new Date(fromDate.getTime() - 86400000)
  const fromDatePrev = new Date(toDatePrev.getTime() - (periodDays - 1) * 86400000)
  const fromStrPrev = formatDateYYYYMMDD(fromDatePrev)
  const toStrPrev = formatDateYYYYMMDD(toDatePrev)
  const fromIsoPrev = `${fromStrPrev}T00:00:00.000Z`
  const toIsoPrev = `${toStrPrev}T23:59:59.999Z`

  let customerName: string | undefined
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, company_name, is_company')
      .eq('id', customerId)
      .maybeSingle()
    if (customer) {
      customerName = customer.is_company ? (customer.company_name || customer.full_name || '') : (customer.full_name || customer.company_name || '')
    }
  }

  const customerFilter = customerId && /^[0-9a-f-]{36}$/i.test(customerId) ? customerId : null

  const buildOpenQuery = () => {
    if (!fetchOpen || openStatuses.length === 0) return null
    let q = supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, closed_at, services, services_total_cents, services_cost_total_cents, payment_methods, is_warranty')
      .in('status', openStatuses)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })
    if (customerFilter) q = q.eq('customer_id', customerFilter)
    return q
  }

  const buildClosedQuery = () => {
    if (!fetchClosed || closedStatuses.length === 0) return null
    let q = supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, closed_at, services, services_total_cents, services_cost_total_cents, payment_methods, is_warranty')
      .in('status', closedStatuses)
      .gte('closed_at', fromIso)
      .lte('closed_at', toIso)
      .order('closed_at', { ascending: false })
    if (customerFilter) q = q.eq('customer_id', customerFilter)
    return q
  }

  const buildOpenPrevQuery = () => {
    if (!fetchOpen || openStatuses.length === 0) return null
    let q = supabase
      .from('service_orders')
      .select('id')
      .in('status', openStatuses)
      .gte('created_at', fromIsoPrev)
      .lte('created_at', toIsoPrev)
    if (customerFilter) q = q.eq('customer_id', customerFilter)
    return q
  }

  const buildClosedPrevQuery = () => {
    if (!fetchClosed || closedStatuses.length === 0) return null
    let q = supabase
      .from('service_orders')
      .select('id, status, created_at, closed_at, services_total_cents, services_cost_total_cents')
      .in('status', closedStatuses)
      .gte('closed_at', fromIsoPrev)
      .lte('closed_at', toIsoPrev)
    if (customerFilter) q = q.eq('customer_id', customerFilter)
    return q
  }

  const openQuery = buildOpenQuery()
  const closedQuery = buildClosedQuery()
  const openPrevQuery = buildOpenPrevQuery()
  const closedPrevQuery = buildClosedPrevQuery()
  const [openPromise, closedPromise, openPrevPromise, closedPrevPromise, paymentMethodsRes] = await Promise.all([
    openQuery ?? Promise.resolve({ data: [] }),
    closedQuery ?? Promise.resolve({ data: [] }),
    openPrevQuery ?? Promise.resolve({ data: [] }),
    closedPrevQuery ?? Promise.resolve({ data: [] }),
    supabase.from('payment_methods').select('id, description, type, fee_percent, credit_installment_fees'),
  ])

  const openList = openPromise.data || []
  const closedList = closedPromise.data || []
  const openListPrev = openPrevPromise.data || []
  const closedListPrev = closedPrevPromise.data || []
  const paymentMethodsCatalog = (paymentMethodsRes.data ?? []) as Array<{
    id: string
    description: string | null
    type: string
    fee_percent: number | null
    credit_installment_fees: Array<{ installments: number; fee_percent: number }> | null
  }>
  const pmById = new Map(paymentMethodsCatalog.map((p) => [p.id, p]))

  const sortedOrders = [...openList, ...closedList].sort((a: ServiceOrderRow, b: ServiceOrderRow) => {
    const dateA = a.closed_at ? new Date(a.closed_at).getTime() : new Date(a.created_at).getTime()
    const dateB = b.closed_at ? new Date(b.closed_at).getTime() : new Date(b.created_at).getTime()
    return dateB - dateA
  })

  const allOrders = sortedOrders.map((o: ServiceOrderRow) => {
    const { payment_fees_cents, net_received_cents, payment_fees_breakdown } = computePaymentFeesAndNet(o, pmById)
    return { ...o, payment_fees_cents, net_received_cents, payment_fees_breakdown }
  })

  const displayOrders = applyFaturamentoFiltro(allOrders, faturamentoFiltroKey)

  const periodLabelPdf = `${formatDateBr(fromStr)} a ${formatDateBr(toStr)}`
  const pdfFilterNote = getPdfFilterNote(faturamentoFiltroKey)

  const openCount = openList.length
  const openCountPrev = openListPrev.length
  const openCountDiff = openCount - openCountPrev
  const closedSuccessCount = closedList.filter((o: ServiceOrderRow) => o.status === FINAL_SUCCESS_STATUS).length
  const closedNoFixCount = closedList.filter((o: ServiceOrderRow) => o.status === FINAL_NO_FIX_STATUS).length

  let totalSlaMs = 0
  let totalSlaCount = 0

  for (const o of closedList) {
    const createdAt = o.created_at ? new Date(String(o.created_at)) : null
    const closedAt = o.closed_at ? new Date(String(o.closed_at)) : null
    if (!createdAt || !closedAt) continue
    const diff = closedAt.getTime() - createdAt.getTime()
    if (diff <= 0) continue
    totalSlaMs += diff
    totalSlaCount += 1
  }

  const avgSlaHours = totalSlaCount > 0 ? totalSlaMs / totalSlaCount / 3600000 : 0

  let grossCents = 0
  let costCents = 0

  for (const o of closedList) {
    const gross = o.services_total_cents ?? 0
    const cost = o.services_cost_total_cents ?? 0
    if (Number.isFinite(gross)) grossCents += Number(gross)
    if (Number.isFinite(cost)) costCents += Number(cost)
  }

  const netCents = grossCents - costCents
  const marginPercent = grossCents > 0 ? (netCents / grossCents) * 100 : 0

  const closedFinalizedCount = closedSuccessCount + closedNoFixCount
  const closedFinalizedPrev = closedListPrev.filter((o: ServiceOrderRow) => o.status === FINAL_SUCCESS_STATUS || o.status === FINAL_NO_FIX_STATUS).length
  const closedFinalizedDiff = closedFinalizedCount - closedFinalizedPrev

  let totalSlaMsPrev = 0
  let totalSlaCountPrev = 0
  for (const o of closedListPrev) {
    const createdAt = o.created_at ? new Date(String(o.created_at)) : null
    const closedAt = o.closed_at ? new Date(String(o.closed_at)) : null
    if (!createdAt || !closedAt) continue
    const diff = closedAt.getTime() - createdAt.getTime()
    if (diff <= 0) continue
    totalSlaMsPrev += diff
    totalSlaCountPrev += 1
  }
  const avgSlaHoursPrev = totalSlaCountPrev > 0 ? totalSlaMsPrev / totalSlaCountPrev / 3600000 : 0
  const avgSlaDiff = avgSlaHours - avgSlaHoursPrev

  let grossCentsPrev = 0
  let costCentsPrev = 0
  for (const o of closedListPrev) {
    const gross = o.services_total_cents ?? 0
    const cost = o.services_cost_total_cents ?? 0
    if (Number.isFinite(gross)) grossCentsPrev += Number(gross)
    if (Number.isFinite(cost)) costCentsPrev += Number(cost)
  }
  const netCentsPrev = grossCentsPrev - costCentsPrev
  const marginPercentPrev = grossCentsPrev > 0 ? (netCentsPrev / grossCentsPrev) * 100 : 0
  const grossDiff = grossCents - grossCentsPrev
  const netDiff = netCents - netCentsPrev
  const marginDiff = marginPercent - marginPercentPrev

  const daysExcludingSundays = countDaysExcludingSundays(fromDate, toDate)
  const avgGrossPerDayCents = daysExcludingSundays > 0 ? Math.round(grossCents / daysExcludingSundays) : 0
  const daysExcludingSundaysPrev = countDaysExcludingSundays(fromDatePrev, toDatePrev)
  const avgGrossPerDayCentsPrev = daysExcludingSundaysPrev > 0 ? Math.round(grossCentsPrev / daysExcludingSundaysPrev) : 0
  const avgGrossPerDayDiff = avgGrossPerDayCents - avgGrossPerDayCentsPrev

  const revenueSeries = buildRevenueSeries(
    closedList.map((o: ServiceOrderRow) => ({
      dateISO: o.closed_at,
      grossCents: o.services_total_cents ?? 0,
      netCents: (o.services_total_cents ?? 0) - (o.services_cost_total_cents ?? 0),
    })),
  )

  const revenueSeriesPrev = buildRevenueSeries(
    closedListPrev.map((o: ServiceOrderRow) => ({
      dateISO: o.closed_at,
      grossCents: o.services_total_cents ?? 0,
      netCents: (o.services_total_cents ?? 0) - (o.services_cost_total_cents ?? 0),
    })),
  )

  const dailyByKey = new Map(revenueSeries.daily.map((b: RevenueBucket) => [b.key, b]))
  const dailyPrevByKey = new Map(revenueSeriesPrev.daily.map((b: RevenueBucket) => [b.key, b]))
  const filledDaily: Array<{ key: string; label: string; grossCents: number; netCents: number; count: number }> = []
  const filledDailyPrev: Array<{ key: string; label: string; grossCents: number; netCents: number; count: number }> = []
  const oneDayMs = 86400000
  for (let i = 0; i < periodDays; i++) {
    const currentDate = new Date(fromDate.getTime() + i * oneDayMs)
    const prevDate = new Date(fromDatePrev.getTime() + i * oneDayMs)
    const currentKey = formatDateYYYYMMDD(currentDate)
    const prevKey = formatDateYYYYMMDD(prevDate)
    const dayLabel = String(currentDate.getUTCDate()).padStart(2, '0')
    const monthLabel = String(currentDate.getUTCMonth() + 1).padStart(2, '0')
    const label = `${dayLabel}/${monthLabel}`
    const curr = dailyByKey.get(currentKey)
    const prev = dailyPrevByKey.get(prevKey)
    filledDaily.push({
      key: currentKey,
      label,
      grossCents: curr?.grossCents ?? 0,
      netCents: curr?.netCents ?? 0,
      count: curr?.count ?? 0,
    })
    filledDailyPrev.push({
      key: prevKey,
      label: `${String(prevDate.getUTCDate()).padStart(2, '0')}/${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`,
      grossCents: prev?.grossCents ?? 0,
      netCents: prev?.netCents ?? 0,
      count: prev?.count ?? 0,
    })
  }

  const situacaoItems = [
    {
      label: 'Finalizada',
      count: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada').length,
      totalCents: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada').reduce((s: number, o: ServiceOrderRow) => s + (Number(o.services_total_cents) || 0), 0),
      barColor: 'hsl(142, 76%, 36%)',
    },
    {
      label: 'Finalizada sem conserto',
      count: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada_sem_conserto').length,
      totalCents: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada_sem_conserto').reduce((s: number, o: ServiceOrderRow) => s + (Number(o.services_total_cents) || 0), 0),
      barColor: 'hsl(215, 16%, 47%)',
    },
    {
      label: 'Finalizada sem aprovação',
      count: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada_sem_aprovacao').length,
      totalCents: closedList.filter((o: ServiceOrderRow) => o.status === 'finalizada_sem_aprovacao').reduce((s: number, o: ServiceOrderRow) => s + (Number(o.services_total_cents) || 0), 0),
      barColor: 'hsl(38, 92%, 50%)',
    },
    {
      label: 'Cancelada',
      count: closedList.filter((o: ServiceOrderRow) => o.status === 'cancelada').length,
      totalCents: closedList.filter((o: ServiceOrderRow) => o.status === 'cancelada').reduce((s: number, o: ServiceOrderRow) => s + (Number(o.services_total_cents) || 0), 0),
      barColor: 'hsl(0, 84%, 60%)',
    },
  ].filter((i) => i.count > 0)

  return (
    <div className="space-y-6">
      <Suspense
        fallback={(
          <div
            className="h-10 max-w-full animate-pulse rounded-md bg-muted/80"
            aria-hidden
          />
        )}
      >
        <VendasAparelhosPeriodBar
          fromStr={fromStr}
          toStr={toStr}
          mergeSearchParams
        />
      </Suspense>

      <form className="grid gap-4 md:grid-cols-4 md:items-end" method="get">
        <input type="hidden" name="from" value={fromStr} />
        <input type="hidden" name="to" value={toStr} />
        {statusGroup ? <input type="hidden" name="statusGroup" value={statusGroup} /> : null}
        {statusArray.map((s) => <input key={s} type="hidden" name="status" value={s} />)}
        <div className="md:col-span-3 space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Status
              </label>
              <RelatorioServicosStatusSelect />
            </div>
            <RelatorioServicosCustomerSelect
              initialCustomerId={customerId}
              initialCustomerName={customerName}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="faturamentoFiltro" className="text-sm font-medium">
                Filtro por valores (cobrado / custo)
              </label>
              <select
                id="faturamentoFiltro"
                name="faturamentoFiltro"
                defaultValue={faturamentoFiltroKey === 'todos' ? '' : faturamentoFiltroKey}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="ambos_zero">Sem cobrado e sem custo (ambos R$ 0)</option>
                <option value="custo_zero_com_cobrado">Custo R$ 0 com valor cobrado</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <RelatorioServicosQuickFilter />
          </div>
          <p className="max-w-xl text-xs leading-snug text-muted-foreground">
            O filtro por valores reflete apenas na tabela e no PDF; gráficos e totais do período continuam com todas as ordens filtradas por data/status.
          </p>
        </div>
        <div className="flex justify-end gap-2 md:justify-end">
          <Button type="submit" variant="secondary">
            Atualizar
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {openCountDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ {openCountDiff}</span>
            )}
            {openCountDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ {openCountDiff}</span>
            )}
            {openCountDiff === 0 && (
              <span className="text-muted-foreground">0</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">{openCount}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ordens abertas</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {closedFinalizedDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ {closedFinalizedDiff}</span>
            )}
            {closedFinalizedDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ {closedFinalizedDiff}</span>
            )}
            {closedFinalizedDiff === 0 && (
              <span className="text-muted-foreground">0</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">{closedFinalizedCount}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ordens finalizadas</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {avgSlaDiff < 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↓ {avgSlaDiff.toFixed(1)} h</span>
            )}
            {avgSlaDiff > 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↑ {avgSlaDiff.toFixed(1)} h</span>
            )}
            {avgSlaDiff === 0 && (
              <span className="text-muted-foreground">0 h</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">{avgSlaHours.toFixed(1)} h</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">SLA médio</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {grossDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ R$ {maskedFromCents(grossDiff)}</span>
            )}
            {grossDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ R$ {maskedFromCents(grossDiff)}</span>
            )}
            {grossDiff === 0 && (
              <span className="text-muted-foreground">R$ 0</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">R$ {maskedFromCents(grossCents)}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Faturamento bruto</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {netDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ R$ {maskedFromCents(netDiff)}</span>
            )}
            {netDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ R$ {maskedFromCents(netDiff)}</span>
            )}
            {netDiff === 0 && (
              <span className="text-muted-foreground">R$ 0</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">R$ {maskedFromCents(netCents)}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Faturamento líquido</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {marginDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ {marginDiff.toFixed(1)} p.p.</span>
            )}
            {marginDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ {marginDiff.toFixed(1)} p.p.</span>
            )}
            {marginDiff === 0 && (
              <span className="text-muted-foreground">0 p.p.</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">{marginPercent.toFixed(1)}%</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Margem</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
          <div className="mb-0.5 flex min-h-[1.25rem] items-center justify-center gap-1 text-xs tabular-nums">
            {avgGrossPerDayDiff > 0 && (
              <span className="font-medium text-green-600 dark:text-green-400">↑ R$ {maskedFromCents(avgGrossPerDayDiff)}</span>
            )}
            {avgGrossPerDayDiff < 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">↓ R$ {maskedFromCents(avgGrossPerDayDiff)}</span>
            )}
            {avgGrossPerDayDiff === 0 && (
              <span className="text-muted-foreground">R$ 0</span>
            )}
          </div>
          <div className="text-xl font-bold tabular-nums">R$ {maskedFromCents(avgGrossPerDayCents)}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Faturamento médio/dia</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px] items-stretch">
        <div className="min-w-0 flex flex-col">
          <RevenueChartTabs
            title="Valor total de pedidos por dia"
            daily={filledDaily}
            weekly={revenueSeries.weekly}
            monthly={revenueSeries.monthly}
            dailyPrevious={filledDailyPrev}
            weeklyPrevious={revenueSeriesPrev.weekly}
            monthlyPrevious={revenueSeriesPrev.monthly}
          />
        </div>
        <RelatorioServicosSituacao
          items={situacaoItems}
          totalCount={closedList.length}
        />
      </div>

      {allOrders.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle>Ordens de serviço</CardTitle>
              <CardDescription>
                Filtradas por período e status selecionados.
                {faturamentoFiltroKey === 'ambos_zero' ? (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400">
                    Mostrando apenas ordens com cobrado e custo em R$ 0,00.
                  </span>
                ) : null}
                {faturamentoFiltroKey === 'custo_zero_com_cobrado' ? (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400">
                    Mostrando apenas ordens com custo R$ 0,00 e valor cobrado maior que zero.
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <RelatorioServicosPdfButton
              orders={displayOrders.map((o: ServiceOrderRow) => ({
                id: String(o.id),
                display_number: o.display_number ?? null,
                status: String(o.status),
                title: o.title ?? null,
                created_at: o.created_at ?? null,
                closed_at: o.closed_at ?? null,
                services_total_cents: o.services_total_cents ?? null,
                services_cost_total_cents: o.services_cost_total_cents ?? null,
                payment_fees_cents: o.payment_fees_cents ?? 0,
              }))}
              periodLabel={periodLabelPdf}
              filterNote={pdfFilterNote}
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {displayOrders.length > 0 ? (
                <RelatorioServicosList orders={displayOrders} />
              ) : (
                <p className="text-sm text-muted-foreground py-6">
                  Nenhuma ordem neste filtro. Ajuste o período, status ou o filtro por valores (cobrado/custo).
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function resolveFaturamentoFiltro (sp: { faturamentoFiltro?: string; semValores?: string }): FaturamentoFiltroKey {
  const raw = String(sp.faturamentoFiltro || '').trim()
  if (raw === 'ambos_zero' || raw === 'custo_zero_com_cobrado') return raw
  if (sp.semValores === '1' || sp.semValores === 'true') return 'ambos_zero'
  return 'todos'
}

function applyFaturamentoFiltro (orders: ServiceOrderRow[], key: FaturamentoFiltroKey): ServiceOrderRow[] {
  if (key === 'todos') return orders
  return orders.filter((o) => {
    const gross = Number(o.services_total_cents) || 0
    const cost = Number(o.services_cost_total_cents) || 0
    if (key === 'ambos_zero') return gross === 0 && cost === 0
    if (key === 'custo_zero_com_cobrado') return cost === 0 && gross > 0
    return true
  })
}

function getPdfFilterNote (key: FaturamentoFiltroKey): string | null {
  if (key === 'ambos_zero') {
    return 'Filtro ativo: somente ordens sem valor cobrado e sem custo (R$ 0,00).'
  }
  if (key === 'custo_zero_com_cobrado') {
    return 'Filtro ativo: custo R$ 0,00 com valor cobrado (> R$ 0,00).'
  }
  return null
}

type PaymentMethodEntryRow = {
  payment_method_id?: unknown
  value_cents?: unknown
  installments?: unknown
}

function computePaymentFeesAndNet(
  order: { payment_methods?: unknown; services_total_cents?: number | null },
  pmById: Map<string, { description: string | null; type: string; fee_percent: number | null; credit_installment_fees: Array<{ installments: number; fee_percent: number }> | null }>
): { payment_fees_cents: number; net_received_cents: number; payment_fees_breakdown: FeeBreakdownItem[] } {
  const gross = order.services_total_cents ?? 0
  let paymentFeesCents = 0
  const breakdown: FeeBreakdownItem[] = []
  const pmRaw = order.payment_methods
  const entries = Array.isArray(pmRaw) ? pmRaw : []
  for (const e of entries) {
    const row = e as PaymentMethodEntryRow
    const pmId = row.payment_method_id
    const valueCents = row.value_cents != null ? Math.max(0, Number(row.value_cents)) : 0
    if (!pmId || valueCents <= 0) continue
    const pm = pmById.get(String(pmId))
    if (!pm) continue
    let feePercent = Number(pm.fee_percent) || 0
    if (pm.type === 'credito' && Array.isArray(pm.credit_installment_fees) && pm.credit_installment_fees.length > 0) {
      const installments = Math.max(1, Number(row.installments) || 1)
      const fees = [...pm.credit_installment_fees].sort((a, b) => a.installments - b.installments)
      const exact = fees.find((f) => f.installments === installments)
      const match = exact ?? fees.filter((f) => f.installments <= installments).pop() ?? fees[0]
      feePercent = match ? match.fee_percent : 0
    }
    const feeCents = feePercent > 0 ? Math.floor((valueCents * feePercent) / 100) : 0
    paymentFeesCents += feeCents
    if (valueCents > 0) {
      breakdown.push({
        type: pm.type || 'outro',
        feePercent,
        valueCents,
        feeCents,
      })
    }
  }
  const netReceivedCents = Math.max(0, gross - paymentFeesCents)
  return { payment_fees_cents: paymentFeesCents, net_received_cents: netReceivedCents, payment_fees_breakdown: breakdown }
}

/** Sem query na URL: mês civil atual (UTC) do dia 1 até hoje — alinhado ao relatório de vendas de aparelhos. */
function getDateRange(from?: string, to?: string) {
  const now = new Date()
  const fallbackTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const fromDate = parseDateParam(from) || fallbackFrom
  const toDate = parseDateParam(to) || fallbackTo

  const fromStr = formatDateYYYYMMDD(fromDate)
  const toStr = formatDateYYYYMMDD(toDate)

  return { fromDate, toDate, fromStr, toStr }
}

function countDaysExcludingSundays(fromDate: Date, toDate: Date): number {
  const from = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()))
  const to = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()))
  if (from.getTime() > to.getTime()) return 0
  let count = 0
  const oneDay = 86400000
  for (let d = from.getTime(); d <= to.getTime(); d += oneDay) {
    if (new Date(d).getUTCDay() !== 0) count += 1
  }
  return count
}

function parseDateParam(value?: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateYYYYMMDD(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
