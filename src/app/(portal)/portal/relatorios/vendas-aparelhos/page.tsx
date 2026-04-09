import nextDynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buildRevenueSeries } from '@/lib/reports/revenue-series'
import {
  isCommissionCostDescription,
  parseCommissionWorkerLabelFromDescription,
} from '@/lib/resale/resale-sale-costs'
import { VendasAparelhosComissoesLista } from '@/components/reports/VendasAparelhosComissoesLista'
import { maskedFromCents } from '@/lib/utils/money'

/** Chunk separado: calendário + presets — reduz grafo do Turbopack na página. */
const VendasAparelhosPeriodBar = nextDynamic(
  () =>
    import('@/components/reports/VendasAparelhosPeriodBar').then((m) => ({
      default: m.VendasAparelhosPeriodBar,
    })),
  {
    loading: () => (
      <div
        className="flex h-10 max-w-full animate-pulse items-center gap-2 overflow-hidden rounded-md bg-muted/80 px-2"
        aria-busy="true"
      />
    ),
  },
)

const RevenueChartTabs = nextDynamic(
  () =>
    import('@/components/reports/RevenueChartTabs').then((m) => ({ default: m.RevenueChartTabs })),
  {
    loading: () => (
      <div
        className="flex h-80 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Carregando gráfico…
      </div>
    ),
  },
)

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

type DtNested = { name?: string | null; device_brands?: { name?: string | null } | { name?: string | null }[] | null }
type ModelRawRow = {
  id: string
  model?: string | null
  device_types?: DtNested | DtNested[] | null
}

type ResaleDeviceRow = {
  id: string
  sold_for_cents?: number | null
  actual_profit_cents?: number | null
  sale_date?: string | null
  device_model_id?: string | null
  device_name?: string | null
  model?: string | null
  sale_commission_user_id?: string | null
}

type ResaleCostRow = {
  resale_device_id: string
  description: string | null
  value_cents: number | null
}

export default async function RelatorioVendasAparelhosPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  return relatorioVendasAparelhosPageContent(sp)
}

async function relatorioVendasAparelhosPageContent (sp: { from?: string; to?: string }) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  if (role !== 'admin') {
    redirect('/portal/dashboard')
  }

  const { fromStr, toStr } = getCurrentMonthRangeOrSearch(sp.from, sp.to)

  const supabase = await createSupabaseServerClient()

  const fromSql = fromStr
  const toSql = toStr

  const { data: soldDevices, error: soldError } = await supabase
    .from('resale_devices')
    .select(
      'id, sold_for_cents, actual_profit_cents, sale_date, device_model_id, device_name, model, sale_commission_user_id',
    )
    .eq('sold', true)
    .gte('sale_date', fromSql)
    .lte('sale_date', toSql)

  if (soldError && process.env.NODE_ENV === 'development') {
    console.warn('[relatório vendas-aparelhos] resale_devices:', soldError.message)
  }

  const list = (soldDevices || []) as ResaleDeviceRow[]

  const modelIds = [...new Set(list.map((d) => d.device_model_id).filter(Boolean))] as string[]

  let modelsRaw: ModelRawRow[] = []
  if (modelIds.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < modelIds.length; i += chunkSize) {
      const slice = modelIds.slice(i, i + chunkSize)
      const { data: chunk, error: modelsError } = await supabase
        .from('device_models')
        .select('id, model, device_types ( name, device_brands ( name ) )')
        .in('id', slice)

      if (modelsError && process.env.NODE_ENV === 'development') {
        console.warn('[relatório vendas-aparelhos] device_models:', modelsError.message)
      }
      modelsRaw = modelsRaw.concat((chunk || []) as ModelRawRow[])
    }
  }
  const models: DeviceModel[] = (modelsRaw || []).map((d: ModelRawRow) => {
    const dt = Array.isArray(d.device_types) ? d.device_types[0] : d.device_types
    const br = dt?.device_brands
    const brandRow = Array.isArray(br) ? br[0] : br
    return {
      id: d.id,
      brand: brandRow?.name ?? null,
      device_type: dt?.name ?? null,
      model: d.model ?? null,
    }
  })
  const modelsMap = buildModelsMap(models)

  const deviceCommission = new Map<string, { cents: number; labelHint: string | null }>()
  if (list.length > 0) {
    const idList = list.map((d) => d.id)
    const costChunk = 100
    for (let i = 0; i < idList.length; i += costChunk) {
      const slice = idList.slice(i, i + costChunk)
      const { data: costRows, error: costsError } = await supabase
        .from('resale_device_costs')
        .select('resale_device_id, description, value_cents')
        .in('resale_device_id', slice)

      if (costsError && process.env.NODE_ENV === 'development') {
        console.warn('[relatório vendas-aparelhos] resale_device_costs:', costsError.message)
      }

      for (const row of (costRows || []) as ResaleCostRow[]) {
        if (!isCommissionCostDescription(row.description)) continue
        const v = Number(row.value_cents) || 0
        if (v <= 0) continue
        const id = row.resale_device_id
        const prev = deviceCommission.get(id) ?? { cents: 0, labelHint: null }
        prev.cents += v
        if (!prev.labelHint) {
          prev.labelHint = parseCommissionWorkerLabelFromDescription(row.description)
        }
        deviceCommission.set(id, prev)
      }
    }
  }

  type CommissionAgg = { cents: number; userId: string | null; fallbackLabel: string }
  type CommissionDeviceLine = {
    deviceId: string
    label: string
    saleDate: string | null
    commissionCents: number
  }
  const commissionAggs = new Map<string, CommissionAgg>()
  const commissionDevicesByGroup = new Map<string, CommissionDeviceLine[]>()
  for (const d of list) {
    const info = deviceCommission.get(d.id)
    if (!info || info.cents <= 0) continue
    const uid = (d.sale_commission_user_id || '').trim() || null
    const mapKey = uid ?? `n:${(info.labelHint || 'Colaborador').trim()}`
    const cur = commissionAggs.get(mapKey) ?? {
      cents: 0,
      userId: uid,
      fallbackLabel: info.labelHint || 'Colaborador',
    }
    cur.cents += info.cents
    commissionAggs.set(mapKey, cur)

    const modelRow = d.device_model_id ? modelsMap[d.device_model_id] ?? null : null
    const deviceLabel = buildModelLabel(modelRow, d.device_name ?? null, d.model ?? null).trim() || '(Sem identificação)'
    const line: CommissionDeviceLine = {
      deviceId: d.id,
      label: deviceLabel,
      saleDate: d.sale_date ?? null,
      commissionCents: info.cents,
    }
    const lines = commissionDevicesByGroup.get(mapKey) ?? []
    lines.push(line)
    commissionDevicesByGroup.set(mapKey, lines)
  }

  for (const lines of commissionDevicesByGroup.values()) {
    lines.sort((a, b) => {
      const da = a.saleDate || ''
      const db = b.saleDate || ''
      if (da !== db) return db.localeCompare(da)
      return b.commissionCents - a.commissionCents
    })
  }

  const commissionUserIds = [
    ...new Set(
      [...commissionAggs.values()]
        .map((a) => a.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const userNameById: Record<string, string> = {}
  if (commissionUserIds.length > 0) {
    const { data: usersRows } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', commissionUserIds)
    for (const u of usersRows || []) {
      const id = u.id as string
      const name = String((u as { full_name?: string | null }).full_name || '').trim()
      const email = String((u as { email?: string | null }).email || '').trim()
      userNameById[id] = name || email || id
    }
  }

  const commissionRows = [...commissionAggs.entries()]
    .map(([groupKey, a]) => ({
      groupKey,
      displayName: a.userId
        ? (userNameById[a.userId] ?? a.userId)
        : a.fallbackLabel,
      cents: a.cents,
      devices: commissionDevicesByGroup.get(groupKey) ?? [],
    }))
    .sort((x, y) => y.cents - x.cents)

  const totalCommissionCents = commissionRows.reduce((s, r) => s + r.cents, 0)

  const salesCount = list.length

  let grossCents = 0
  let netCents = 0

  for (const d of list) {
    const gross = d.sold_for_cents ?? 0
    const net = d.actual_profit_cents ?? 0
    if (Number.isFinite(gross)) grossCents += Number(gross)
    if (Number.isFinite(net)) netCents += Number(net)
  }

  const marginPercent = grossCents > 0 ? (netCents / grossCents) * 100 : 0

  const revenueSeries = buildRevenueSeries(
    list.map((d: ResaleDeviceRow) => ({
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
      <VendasAparelhosPeriodBar fromStr={fromStr} toStr={toStr} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-600 sm:text-3xl dark:text-emerald-400">
              {salesCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="break-words text-2xl font-bold tabular-nums text-emerald-600 sm:text-3xl dark:text-emerald-400">
              R$ {maskedFromCents(grossCents)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Valor bruto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="break-words text-2xl font-bold tabular-nums text-emerald-600 sm:text-3xl dark:text-emerald-400">
              R$ {maskedFromCents(netCents)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Valor líquido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-600 sm:text-3xl dark:text-emerald-400">
              {marginPercent.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Margem
            </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Comissões no período</CardTitle>
          <CardDescription>
            Valores registrados como custo de comissão nas vendas (linhas “Comissão venda” por aparelho).
            {' '}
            Clique no colaborador para ver os aparelhos que compõem o total.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {commissionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma comissão encontrada neste intervalo.
            </p>
          ) : (
            <VendasAparelhosComissoesLista
              rows={commissionRows}
              totalCents={totalCommissionCents}
            />
          )}
        </CardContent>
      </Card>
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
  devices: ResaleDeviceRow[],
  modelsMap: Record<string, DeviceModel>,
  metric: TopMetric,
  limit: number,
): TopItem[] {
  const agg = new Map<string, TopItem>()

  for (const d of devices) {
    const modelId = d.device_model_id ?? null
    const modelRow = modelId ? modelsMap[modelId] : null
    const label = buildModelLabel(
      modelRow,
      d.device_name ?? null,
      d.model ?? null,
    )

    const key = modelId || label
    if (!key) continue

    const gross = d.sold_for_cents ?? 0
    const net = d.actual_profit_cents ?? 0

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

