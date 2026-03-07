import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { DashboardSeminovosCard } from '@/components/dashboard/DashboardSeminovosCard'
import { DashboardOsAtivasCard } from '@/components/dashboard/DashboardOsAtivasCard'
import { DashboardAguardandoPecasCard } from '@/components/dashboard/DashboardAguardandoPecasCard'
import { DashboardAlertaAmareloCard } from '@/components/dashboard/DashboardAlertaAmareloCard'
import { DashboardAlertaVermelhoCard } from '@/components/dashboard/DashboardAlertaVermelhoCard'

export const dynamic = 'force-dynamic'

const OPEN_STATUSES = [
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
]

const OPEN_STATUSES_FOR_ALERTS = OPEN_STATUSES.filter((s) => s !== 'aguardando_retirada')

function oneBusinessDayAgo(now: Date): Date {
  const t = new Date(now.getTime())
  t.setUTCDate(t.getUTCDate() - 1)
  while (t.getUTCDay() === 0 || t.getUTCDay() === 6) {
    t.setUTCDate(t.getUTCDate() - 1)
  }
  return t
}

function seminovosGroupSortKey(label: string): { num: number; variant: number } {
  const lower = label.toLowerCase()
  const numbers = label.match(/\d+/g)
  const num = numbers && numbers.length > 0 ? Number(numbers[0]) : 0
  if (lower.includes('pro max')) return { num, variant: 2 }
  if (lower.includes('pro')) return { num, variant: 1 }
  return { num, variant: 0 }
}

export default async function DashboardPage() {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  const isStaffOrAdmin = normalizedRole === 'staff' || normalizedRole === 'admin'

  const now = new Date()
  const nowMs = now.getTime()
  const in30Min = new Date(nowMs + 30 * 60 * 1000)
  const oneDayAgo = oneBusinessDayAgo(now)

  const staffFetches = isStaffOrAdmin
    ? [
        supabase
          .from('resale_devices')
          .select('id, device_model_id, device_name, model, color, sale_value_cents')
          .eq('sold', false),
        supabase
          .from('device_models')
          .select('id, model, device_types ( name, device_brands ( name ) )'),
        supabase
          .from('service_orders')
          .select('id, display_number, status, title, created_at, estimated_ready_at')
          .in('status', OPEN_STATUSES)
          .order('created_at', { ascending: false }),
      ]
    : []

  const staffResults = isStaffOrAdmin ? await Promise.all(staffFetches) : []

  let seminovosGroups: Array<{ label: string; total: number; byColor: Record<string, { count: number; minCents: number; maxCents: number; hasValue: boolean }>; minCents: number; maxCents: number; hasAnyValue: boolean }> = []
  let openOrdersList: Array<{ id: string; display_number: string | null; status: string; title: string }> = []
  let statusCounts: Record<string, number> = {}
  let ordersNearDeadline: Array<{ id: string; display_number: string | null; title: string; status: string }> = []
  let ordersOverdueOrOld: Array<{ id: string; display_number: string | null; title: string; status: string }> = []
  let ordersAguardandoPecas: Array<{ id: string; display_number: string | null; status: string; title: string }> = []

  if (isStaffOrAdmin && staffResults.length >= 3) {
    const [devicesRes, modelsRes, openOrdersRes] = staffResults as [
      { data: Array<{ id: string; device_model_id: string | null; device_name: string | null; model: string | null; color: string | null; sale_value_cents: number | null }> | null },
      { data: Array<{ id: string; model: string | null; device_types: { name: string; device_brands: { name: string } } | null }> | null },
      { data: Array<{ id: string; display_number: string | null; status: string; title: string; created_at: string; estimated_ready_at: string | null }> | null },
    ]
    const devices = devicesRes?.data ?? []
    const modelsRaw = modelsRes?.data ?? []
    const openOrdersRaw = openOrdersRes?.data ?? []

    const modelLabels = new Map<string, string>()
    for (const m of modelsRaw) {
      const dt = (m as any).device_types ?? null
      const brand = dt?.device_brands ?? null
      const brandName = brand?.name ?? ''
      const modelName = (m as any).model ?? ''
      const label = [brandName, modelName].filter(Boolean).join(' ') || 'Sem modelo'
      modelLabels.set((m as any).id, label)
    }

    const byLabel = new Map<string, Array<{ color: string | null; sale_value_cents: number | null }>>()
    for (const d of devices) {
      const label = d.device_model_id
        ? (modelLabels.get(d.device_model_id) || d.device_name || d.model || 'Outro')
        : (d.device_name || d.model || 'Outro')
      if (!byLabel.has(label)) byLabel.set(label, [])
      byLabel.get(label)!.push({ color: d.color, sale_value_cents: d.sale_value_cents })
    }
    seminovosGroups = Array.from(byLabel.entries()).map(([label, items]) => {
      const byColor: Record<string, { count: number; minCents: number; maxCents: number; hasValue: boolean }> = {}
      let groupMinCents = 0
      let groupMaxCents = 0
      let hasAnyValue = false
      for (const it of items) {
        const cor = (it.color || '').trim() || 'Sem cor'
        const cents = it.sale_value_cents != null && Number.isFinite(it.sale_value_cents) ? it.sale_value_cents : null
        if (!byColor[cor]) {
          byColor[cor] = { count: 0, minCents: 0, maxCents: 0, hasValue: false }
        }
        const cur = byColor[cor]
        cur.count += 1
        if (cents !== null) {
          if (!cur.hasValue) {
            cur.hasValue = true
            cur.minCents = cents
            cur.maxCents = cents
          } else {
            cur.minCents = Math.min(cur.minCents, cents)
            cur.maxCents = Math.max(cur.maxCents, cents)
          }
          if (!hasAnyValue) {
            groupMinCents = cents
            groupMaxCents = cents
            hasAnyValue = true
          } else {
            groupMinCents = Math.min(groupMinCents, cents)
            groupMaxCents = Math.max(groupMaxCents, cents)
          }
        }
      }
      return {
        label,
        total: items.length,
        byColor,
        minCents: groupMinCents,
        maxCents: groupMaxCents,
        hasAnyValue,
      }
    })
    seminovosGroups.sort((a, b) => {
      const ka = seminovosGroupSortKey(a.label)
      const kb = seminovosGroupSortKey(b.label)
      if (ka.num !== kb.num) return kb.num - ka.num
      if (ka.variant !== kb.variant) return kb.variant - ka.variant
      return b.total - a.total
    })

    for (const o of openOrdersRaw) {
      openOrdersList.push({
        id: o.id,
        display_number: o.display_number,
        status: o.status,
        title: o.title,
      })
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
    }

    const nowIso = now.toISOString()
    const in30MinIso = in30Min.toISOString()
    const oneDayAgoIso = oneDayAgo.toISOString()

    const alertStatusSet = new Set(OPEN_STATUSES_FOR_ALERTS)
    for (const o of openOrdersRaw) {
      if (!alertStatusSet.has(o.status)) continue
      const est = o.estimated_ready_at ?? null
      const created = o.created_at ?? null
      if (est) {
        if (est >= nowIso && est <= in30MinIso) {
          ordersNearDeadline.push({ id: o.id, display_number: o.display_number, title: o.title, status: o.status })
        }
        if (est < nowIso) {
          ordersOverdueOrOld.push({ id: o.id, display_number: o.display_number, title: o.title, status: o.status })
        }
      }
      if (created && created < oneDayAgoIso) {
        const alreadyOverdue = ordersOverdueOrOld.some((x) => x.id === o.id)
        if (!alreadyOverdue) {
          ordersOverdueOrOld.push({ id: o.id, display_number: o.display_number, title: o.title, status: o.status })
        }
      }
    }
    ordersAguardandoPecas = openOrdersRaw
      .filter((o) => o.status === 'aguardando_pecas')
      .map((o) => ({ id: o.id, display_number: o.display_number, status: o.status, title: o.title }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumo rápido do portal.
        </p>
      </div>

      {isStaffOrAdmin && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <DashboardSeminovosCard
            totalAvailable={seminovosGroups.reduce((s, g) => s + g.total, 0)}
            groups={seminovosGroups}
          />
          <DashboardOsAtivasCard
            total={openOrdersList.length}
            orders={openOrdersList}
            statusCounts={statusCounts}
          />
          <DashboardAguardandoPecasCard orders={ordersAguardandoPecas} />
          <DashboardAlertaAmareloCard orders={ordersNearDeadline} />
          <DashboardAlertaVermelhoCard orders={ordersOverdueOrOld} />
        </div>
      )}
    </div>
  )
}

