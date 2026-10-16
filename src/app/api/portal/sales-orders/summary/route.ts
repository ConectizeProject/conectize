import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  addBrazilCalendarDays,
  brazilCurrentMonthRange,
  brazilPreviousMonthRange,
  brazilTodayDateString,
} from '@/lib/dashboard/brazil-day'
import { backfillMeliPurchaseDates } from '@/lib/integrations/mercado-livre/order-sync'
import { buildMeliShippingBoard } from '@/lib/vendas/meli-shipping-board'

type DayTotals = {
  count: number
  totalCents: number
}

function emptyDays (startDate: string, endDate: string) {
  const days: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    days.push(cursor)
    cursor = addBrazilCalendarDays(cursor, 1)
  }
  return days
}

function brazilDateKey (iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return brazilTodayDateString(parsed)
}

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Alinha created_at dos pedidos MELI com a data da compra antes de montar o histórico.
  try {
    await backfillMeliPurchaseDates({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      limit: 80,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[sales-orders summary backfill]', message)
  }

  const current = brazilCurrentMonthRange()
  const previous = brazilPreviousMonthRange()
  const today = brazilTodayDateString()
  const currentEnd = today < current.endDate ? today : current.endDate
  const rows: Array<{ created_at?: string, total_cents?: number }> = []

  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await auth.supabase
      .from('sales_orders')
      .select('created_at, total_cents')
      .eq('organization_id', auth.organizationId)
      .eq('status', 'paid')
      .gte('created_at', previous.startIso)
      .lte('created_at', current.endIso)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) {
      console.error('[sales-orders summary]', error.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
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
  const sum = (days: Array<{ count: number, totalCents: number }>) => days.reduce(
    (acc, day) => ({
      count: acc.count + day.count,
      totalCents: acc.totalCents + day.totalCents,
    }),
    { count: 0, totalCents: 0 },
  )

  const shippingRows: Array<{
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
  const shippingSelectFull =
    'status, ml_order_id, ml_logistic_type, ml_fulfillment_stage, ml_shipment_status, ml_shipment_substatus, ml_posting_deadline, ml_label_available_at, ml_shipping_method'
  const shippingSelectWithDates =
    'status, ml_order_id, ml_logistic_type, ml_fulfillment_stage, ml_shipment_status, ml_shipment_substatus, ml_posting_deadline, ml_label_available_at'
  const shippingSelectBasic =
    'status, ml_order_id, ml_logistic_type, ml_fulfillment_stage, ml_shipment_status, ml_shipment_substatus'
  let shippingSelect = shippingSelectFull
  for (let from = 0; from < 3000; from += 1000) {
    const { data, error } = await auth.supabase
      .from('sales_orders')
      .select(shippingSelect)
      .eq('organization_id', auth.organizationId)
      .not('ml_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) {
      if (
        shippingSelect === shippingSelectFull
        && /ml_shipping_method|does not exist|schema cache/i.test(error.message)
      ) {
        shippingSelect = shippingSelectWithDates
        from -= 1000
        continue
      }
      if (
        shippingSelect === shippingSelectWithDates
        && /ml_posting_deadline|ml_label_available_at|does not exist|schema cache/i.test(error.message)
      ) {
        shippingSelect = shippingSelectBasic
        from -= 1000
        continue
      }
      console.error('[sales-orders summary shipping]', error.message)
      break
    }
    shippingRows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  return NextResponse.json({
    ok: true,
    current: {
      ...sum(currentDays),
      days: currentDays,
      startDate: current.startDate,
      endDate: currentEnd,
      label: current.displayLabel,
    },
    previous: {
      ...sum(previousDays),
      days: previousDays,
      startDate: previous.startDate,
      endDate: previous.endDate,
      label: previous.displayLabel,
    },
    shippingBoard: buildMeliShippingBoard(shippingRows),
  })
}
