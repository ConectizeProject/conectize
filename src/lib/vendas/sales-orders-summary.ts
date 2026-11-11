import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addBrazilCalendarDays,
  brazilCurrentMonthRange,
  brazilDayRangeUtc,
  brazilPreviousMonthRange,
  brazilTodayDateString,
} from '@/lib/dashboard/brazil-day'
import { hasMarketplaceHubConnection } from '@/lib/integrations/marketplace-platforms'
import { backfillMeliPurchaseDates } from '@/lib/integrations/mercado-livre/order-sync'
import {
  buildMeliShippingBoard,
  type MeliShippingBoard,
} from '@/lib/vendas/meli-shipping-board'

type DayTotals = {
  count: number
  totalCents: number
}

export type SalesSummaryDayPoint = {
  day: string
  count: number
  totalCents: number
}

export type SalesMonthSummary = {
  count: number
  totalCents: number
  days: SalesSummaryDayPoint[]
  startDate: string
  endDate: string
  label: string
}

export type SalesChartsSummary = {
  current: SalesMonthSummary
  previous: SalesMonthSummary
}

export type SalesShippingBoardSummary = {
  showShippingBoard: boolean
  shippingBoard: MeliShippingBoard | null
}

function emptyDays (startDate: string, endDate: string) {
  const days: string[] = []
  let cursor = startDate
  let guard = 0
  while (cursor <= endDate && guard < 400) {
    days.push(cursor)
    cursor = addBrazilCalendarDays(cursor, 1)
    guard += 1
  }
  return days
}

function brazilDateKey (iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return brazilTodayDateString(parsed)
}

function sumDays (days: Array<{ count: number, totalCents: number }>) {
  return days.reduce(
    (acc, day) => ({
      count: acc.count + day.count,
      totalCents: acc.totalCents + day.totalCents,
    }),
    { count: 0, totalCents: 0 },
  )
}

export function scheduleMeliPurchaseDatesBackfill (input: {
  supabase: SupabaseClient
  organizationId: string
}) {
  // Não bloqueia o summary: backfill em background (TTL interno evita spam).
  void backfillMeliPurchaseDates({
    supabase: input.supabase,
    organizationId: input.organizationId,
    limit: 40,
  }).catch((err) => {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[sales-orders summary backfill]', message)
  })
}

export async function loadSalesChartsSummary (input: {
  supabase: SupabaseClient
  organizationId: string
}): Promise<SalesChartsSummary> {
  const current = brazilCurrentMonthRange()
  const previous = brazilPreviousMonthRange()
  const today = brazilTodayDateString()
  const currentEnd = today < current.endDate ? today : current.endDate
  const rows: Array<{ created_at?: string | null, total_cents?: number | null }> = []

  for (let from = 0; from < 5000; from += 1000) {
    const listed = await input.supabase
      .from('sales_orders')
      .select('created_at, total_cents')
      .eq('organization_id', input.organizationId)
      .eq('status', 'paid')
      .gte('created_at', previous.startIso)
      .lte('created_at', current.endIso)
      .order('created_at', { ascending: true })
      .range(from, from + 999)

    if (listed.error) {
      console.error('[sales-orders summary charts]', listed.error.message)
      break
    }

    rows.push(...(listed.data ?? []))
    if (!listed.data || listed.data.length < 1000) break
  }

  const currentByDay = new Map<string, DayTotals>()
  const previousByDay = new Map<string, DayTotals>()
  for (const row of rows) {
    const day = brazilDateKey(String(row.created_at || ''))
    if (!day) continue
    const bucket = day >= current.startDate ? currentByDay : previousByDay
    const totals = bucket.get(day) ?? { count: 0, totalCents: 0 }
    totals.count += 1
    totals.totalCents += Math.max(0, Number(row.total_cents) || 0)
    bucket.set(day, totals)
  }

  function series (startDate: string, endDate: string, source: Map<string, DayTotals>) {
    return emptyDays(startDate, endDate).map((day) => {
      const totals = source.get(day) ?? { count: 0, totalCents: 0 }
      return { day, count: totals.count, totalCents: totals.totalCents }
    })
  }

  const currentDays = series(current.startDate, currentEnd, currentByDay)
  const previousDays = series(previous.startDate, previous.endDate, previousByDay)

  return {
    current: {
      ...sumDays(currentDays),
      days: currentDays,
      startDate: current.startDate,
      endDate: currentEnd,
      label: current.displayLabel,
    },
    previous: {
      ...sumDays(previousDays),
      days: previousDays,
      startDate: previous.startDate,
      endDate: previous.endDate,
      label: previous.displayLabel,
    },
  }
}

export async function loadSalesShippingBoardSummary (input: {
  supabase: SupabaseClient
  organizationId: string
  /** Janela em dias corridos BR (default 45). */
  lookbackDays?: number
}): Promise<SalesShippingBoardSummary> {
  const showShippingBoard = await hasMarketplaceHubConnection(input.supabase)
  if (!showShippingBoard) {
    return { showShippingBoard: false, shippingBoard: null }
  }

  const today = brazilTodayDateString()
  const lookbackDays = input.lookbackDays ?? 45
  const shippingSince = addBrazilCalendarDays(today, -lookbackDays)
  const shippingSinceIso = brazilDayRangeUtc(shippingSince).startIso

  let shippingRows: Array<{
    id?: string | null
    status?: string | null
    ml_order_id?: string | null
    ml_logistic_type?: string | null
    ml_fulfillment_stage?: string | null
    ml_shipment_status?: string | null
    ml_shipment_substatus?: string | null
    ml_posting_deadline?: string | null
    ml_label_available_at?: string | null
    ml_shipping_method?: string | null
  }> = []

  for (let from = 0; from < 1000; from += 500) {
    const listed = await input.supabase
      .from('sales_orders')
      .select('id, status, ml_order_id, ml_logistic_type, ml_fulfillment_stage, ml_shipment_status, ml_shipment_substatus, ml_posting_deadline, ml_label_available_at, ml_shipping_method')
      .eq('organization_id', input.organizationId)
      .not('ml_order_id', 'is', null)
      .gte('created_at', shippingSinceIso)
      .order('created_at', { ascending: false })
      .range(from, from + 499)

    if (listed.error) {
      if (/ml_shipping_method|ml_posting_deadline|ml_label_available_at|does not exist|schema cache/i.test(listed.error.message)) {
        const basic = await input.supabase
          .from('sales_orders')
          .select('id, status, ml_order_id, ml_logistic_type, ml_fulfillment_stage, ml_shipment_status, ml_shipment_substatus')
          .eq('organization_id', input.organizationId)
          .not('ml_order_id', 'is', null)
          .gte('created_at', shippingSinceIso)
          .order('created_at', { ascending: false })
          .range(from, from + 499)
        if (basic.error) {
          console.error('[sales-orders summary shipping]', basic.error.message)
          break
        }
        shippingRows.push(...(basic.data ?? []))
        if (!basic.data || basic.data.length < 500) break
        continue
      }
      console.error('[sales-orders summary shipping]', listed.error.message)
      break
    }

    shippingRows.push(...(listed.data ?? []))
    if (!listed.data || listed.data.length < 500) break
  }

  return {
    showShippingBoard: true,
    shippingBoard: buildMeliShippingBoard(shippingRows),
  }
}
