import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildRevenueSeries } from '@/lib/reports/revenue-series'
import { RevenueChartTabs } from '@/components/reports/RevenueChartTabs'
import { QuickDatePresets } from '@/components/reports/QuickDatePresets'
import { maskedFromCents } from '@/lib/utils/money'

export const dynamic = 'force-dynamic'

const OPEN_STATUSES = [
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
] as const

const FINAL_SUCCESS_STATUS = 'finalizada'
const FINAL_NO_FIX_STATUS = 'finalizada_sem_conserto'

type SearchParams = Promise<{
  from?: string
  to?: string
}>

export default async function RelatorioServicosPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  if (role !== 'admin') {
    redirect('/portal/dashboard')
  }

  const { from, to } = await searchParams
  const { fromDate, toDate, fromStr, toStr } = getDateRange(from, to, 30)

  const supabase = await createSupabaseServerClient()

  const fromIso = `${fromStr}T00:00:00.000Z`
  const toIso = `${toStr}T23:59:59.999Z`

  const [{ data: openOrders }, { data: closedOrders }] = await Promise.all([
    supabase
      .from('service_orders')
      .select('id, status, created_at')
      .in('status', [...OPEN_STATUSES])
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('service_orders')
      .select('id, status, created_at, closed_at, services_total_cents, services_cost_total_cents')
      .in('status', [
        'finalizada',
        'finalizada_sem_conserto',
        'finalizada_sem_aprovacao',
        'cancelada',
      ])
      .gte('closed_at', fromIso)
      .lte('closed_at', toIso),
  ])

  const openList = openOrders || []
  const closedList = closedOrders || []

  const openCount = openList.length
  const closedSuccessCount = closedList.filter((o: any) => o.status === FINAL_SUCCESS_STATUS).length
  const closedNoFixCount = closedList.filter((o: any) => o.status === FINAL_NO_FIX_STATUS).length

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
    const gross = (o as any).services_total_cents ?? 0
    const cost = (o as any).services_cost_total_cents ?? 0
    if (Number.isFinite(gross)) grossCents += Number(gross)
    if (Number.isFinite(cost)) costCents += Number(cost)
  }

  const netCents = grossCents - costCents
  const marginPercent = grossCents > 0 ? (netCents / grossCents) * 100 : 0

  const revenueSeries = buildRevenueSeries(
    closedList.map((o: any) => ({
      dateISO: o.closed_at,
      grossCents: o.services_total_cents ?? 0,
      netCents: (o.services_total_cents ?? 0) - (o.services_cost_total_cents ?? 0),
    })),
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Serviços</h2>
        <p className="text-sm text-muted-foreground">
          Visão consolidada das ordens de serviço no período selecionado.
        </p>
      </div>

      <form className="grid gap-4 md:grid-cols-4 items-end">
        <div className="md:col-span-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className="text-sm font-medium">
                Data inicial
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={formatInputDate(fromDate)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className="text-sm font-medium">
                Data final
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={formatInputDate(toDate)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <QuickDatePresets />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="submit" variant="secondary">
            Atualizar
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ordens abertas</CardTitle>
            <CardDescription>Com criação entre {formatRangeLabel(fromDate, toDate)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordens finalizadas</CardTitle>
            <CardDescription>Sucesso x sem conserto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold">{closedSuccessCount}</div>
            <div className="text-sm text-muted-foreground">
              {closedNoFixCount} sem conserto
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA médio</CardTitle>
            <CardDescription>Da abertura até o fechamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgSlaHours.toFixed(1)} h
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento bruto</CardTitle>
            <CardDescription>Serviços finalizados no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              R$ {maskedFromCents(grossCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faturamento líquido</CardTitle>
            <CardDescription>Após custos de serviços</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              R$ {maskedFromCents(netCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margem de participação</CardTitle>
            <CardDescription>Lucro / faturamento bruto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {marginPercent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <RevenueChartTabs
        title="Faturamento por serviços"
        daily={revenueSeries.daily}
        weekly={revenueSeries.weekly}
        monthly={revenueSeries.monthly}
      />
    </div>
  )
}

function getDateRange (from?: string, to?: string, fallbackDays = 30) {
  const now = new Date()
  const fallbackTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const fallbackFrom = new Date(fallbackTo.getTime() - (fallbackDays - 1) * 86400000)

  const fromDate = parseDateParam(from) || fallbackFrom
  const toDate = parseDateParam(to) || fallbackTo

  const fromStr = formatDateYYYYMMDD(fromDate)
  const toStr = formatDateYYYYMMDD(toDate)

  return { fromDate, toDate, fromStr, toStr }
}

function parseDateParam (value?: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateYYYYMMDD (date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatInputDate (date: Date) {
  return formatDateYYYYMMDD(date)
}

function formatRangeLabel (from: Date, to: Date) {
  const fromLabel = formatBrDate(from)
  const toLabel = formatBrDate(to)
  if (fromLabel === toLabel) return fromLabel
  return `${fromLabel} a ${toLabel}`
}

function formatBrDate (date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${day}/${month}/${year}`
}

