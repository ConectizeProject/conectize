import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildRevenueSeries } from '@/lib/reports/revenue-series'
import { RevenueChartTabs } from '@/components/reports/RevenueChartTabs'
import { QuickDatePresets } from '@/components/reports/QuickDatePresets'
import { maskedFromCents } from '@/lib/utils/money'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  from?: string
  to?: string
}>

type DeviceModel = {
  id: string
  brand: string | null
  device_type: string | null
  model: string | null
}

export default async function RelatorioVendasAparelhosPage ({
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
  const { fromDate, toDate, fromStr, toStr } = getCurrentMonthRangeOrSearch(from, to)

  const supabase = await createSupabaseServerClient()

  const fromSql = fromStr
  const toSql = toStr

  const [{ data: soldDevices }, { data: modelsRaw }] = await Promise.all([
    supabase
      .from('resale_devices')
      .select('id, sold_for_cents, actual_profit_cents, sale_date, device_model_id, device_name, model')
      .eq('sold', true)
      .gte('sale_date', fromSql)
      .lte('sale_date', toSql),
    supabase
      .from('device_models')
      .select('id, model, device_types ( name, device_brands ( name ) )')
      .limit(5000),
  ])

  const list = soldDevices || []
  const models: DeviceModel[] = (modelsRaw || []).map((d: any) => {
    const dt = d.device_types || null
    const brandRow = dt?.device_brands || null
    return {
      id: d.id,
      brand: brandRow?.name ?? null,
      device_type: dt?.name ?? null,
      model: d.model ?? null,
    }
  })
  const modelsMap = buildModelsMap(models)

  const salesCount = list.length

  let grossCents = 0
  let netCents = 0

  for (const d of list) {
    const gross = (d as any).sold_for_cents ?? 0
    const net = (d as any).actual_profit_cents ?? 0
    if (Number.isFinite(gross)) grossCents += Number(gross)
    if (Number.isFinite(net)) netCents += Number(net)
  }

  const marginPercent = grossCents > 0 ? (netCents / grossCents) * 100 : 0

  const revenueSeries = buildRevenueSeries(
    list.map((d: any) => ({
      dateISO: d.sale_date,
      grossCents: d.sold_for_cents ?? 0,
      netCents: d.actual_profit_cents ?? 0,
    })),
  )

  const topByQuantity = buildTopModels(list, modelsMap, 'quantity', 10)
  const topByGross = buildTopModels(list, modelsMap, 'gross', 10)
  const topByNet = buildTopModels(list, modelsMap, 'net', 10)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Venda de aparelhos</h2>
        <p className="text-sm text-muted-foreground">
          Visão consolidada das vendas de aparelhos seminovos no período selecionado.
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
            <CardTitle>Quantidade de vendas</CardTitle>
            <CardDescription>No período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{salesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valor bruto</CardTitle>
            <CardDescription>Somatório de vendas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              R$ {maskedFromCents(grossCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valor líquido</CardTitle>
            <CardDescription>Lucro consolidado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              R$ {maskedFromCents(netCents)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Margem</CardTitle>
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
        title="Faturamento por venda de aparelhos"
        daily={revenueSeries.daily}
        weekly={revenueSeries.weekly}
        monthly={revenueSeries.monthly}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Modelos mais vendidos</CardTitle>
            <CardDescription>Top 10 por quantidade</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {topByQuantity.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  <span className="font-mono tabular-nums">{item.quantity}</span>
                </li>
              ))}
              {topByQuantity.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhum modelo encontrado no período.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maior valor bruto</CardTitle>
            <CardDescription>Top 10 por faturamento bruto</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {topByGross.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  <span className="font-mono tabular-nums">
                    R$ {maskedFromCents(item.grossCents)}
                  </span>
                </li>
              ))}
              {topByGross.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhum modelo encontrado no período.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maior valor líquido</CardTitle>
            <CardDescription>Top 10 por lucro</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {topByNet.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  <span className="font-mono tabular-nums">
                    R$ {maskedFromCents(item.netCents)}
                  </span>
                </li>
              ))}
              {topByNet.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhum modelo encontrado no período.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getCurrentMonthRangeOrSearch (from?: string, to?: string) {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const fromDate = parseDateParam(from) || monthStart
  const toDate = parseDateParam(to) || today

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

type TopMetric = 'quantity' | 'gross' | 'net'

type TopItem = {
  key: string
  label: string
  quantity: number
  grossCents: number
  netCents: number
}

function buildModelsMap (models: DeviceModel[]) {
  const map: Record<string, DeviceModel> = {}
  for (const m of models) {
    map[m.id] = m
  }
  return map
}

function buildTopModels (
  devices: any[],
  modelsMap: Record<string, DeviceModel>,
  metric: TopMetric,
  limit: number,
): TopItem[] {
  const agg = new Map<string, TopItem>()

  for (const d of devices) {
    const modelId = (d as any).device_model_id as string | null
    const modelRow = modelId ? modelsMap[modelId] : null
    const label = buildModelLabel(
      modelRow,
      (d as any).device_name as string | null,
      (d as any).model as string | null,
    )

    const key = modelId || label
    if (!key) continue

    const gross = (d as any).sold_for_cents ?? 0
    const net = (d as any).actual_profit_cents ?? 0

    const existing = agg.get(key)
    if (existing) {
      existing.quantity += 1
      if (Number.isFinite(gross)) existing.grossCents += Number(gross)
      if (Number.isFinite(net)) existing.netCents += Number(net)
    } else {
      agg.set(key, {
        key,
        label: label || '(Sem modelo)',
        quantity: 1,
        grossCents: Number.isFinite(gross) ? Number(gross) : 0,
        netCents: Number.isFinite(net) ? Number(net) : 0,
      })
    }
  }

  const items = Array.from(agg.values())

  items.sort((a, b) => {
    if (metric === 'quantity') {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return b.grossCents - a.grossCents
    }
    if (metric === 'gross') {
      if (b.grossCents !== a.grossCents) return b.grossCents - a.grossCents
      return b.quantity - a.quantity
    }
    if (b.netCents !== a.netCents) return b.netCents - a.netCents
    return b.quantity - a.quantity
  })

  return items.slice(0, limit)
}

function buildModelLabel (
  model: DeviceModel | null,
  deviceName: string | null,
  fallbackModel: string | null,
) {
  if (model) {
    const parts = [model.brand, model.device_type, model.model].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  if (deviceName && deviceName.trim().length > 0) return deviceName.trim()
  if (fallbackModel && fallbackModel.trim().length > 0) return fallbackModel.trim()
  return ''
}

