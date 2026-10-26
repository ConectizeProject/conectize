import { brazilTodayDateString } from '@/lib/dashboard/brazil-day'
import type { SalesLane } from '@/lib/vendas/sales-lane'

export type MeliShippingTabId = 'today' | 'upcoming' | 'transit' | 'finished'

export type MeliShippingCardLine = {
  id: string
  title: string
  detail: string | null
  count: number
  lane: SalesLane
}

export type MeliShippingCard = {
  id: string
  section: 'to_ship' | 'in_progress'
  sectionLabel: string
  title: string
  subtitle: string | null
  count: number
  footerLabel: string | null
  footerCount: number
  lane: SalesLane
  lines: MeliShippingCardLine[]
}

export type MeliShippingBoard = {
  tabs: Array<{
    id: MeliShippingTabId
    label: string
    count: number
    showCount: boolean
    lane: SalesLane
  }>
  cardsByTab: Record<MeliShippingTabId, MeliShippingCard[]>
}

export type MeliShippingOrderRow = {
  status?: string | null
  ml_order_id?: string | null
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
  ml_posting_deadline?: string | null
  ml_label_available_at?: string | null
  ml_shipping_method?: string | null
}

function norm (value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function brazilDateKey (iso: string | null | undefined) {
  const raw = String(iso || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return brazilTodayDateString(parsed)
}

/** DD/MM a partir de YYYY-MM-DD (fuso BR). */
export function formatMeliShipReadyDayLabel (dateKey: string | null | undefined) {
  const raw = String(dateKey || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!match) return null
  return `${match[3]}/${match[2]}`
}

/** "Até 21h" / "Até 12:30h" a partir do prazo de postagem. */
export function formatMeliPostingDeadlineUntil (iso: string | null | undefined) {
  const raw = String(iso || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed)
  const hourRaw = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value || '00'
  if (hourRaw == null) return null
  const hour = String(Number(hourRaw))
  if (minute === '00') return `Até ${hour}h`
  return `Até ${hour}:${minute}h`
}

/**
 * Dia em que a etiqueta libera para o vendedor.
 * Usa só ml_label_available_at (não o prazo de postagem).
 */
export function meliShipReadyDateKey (row: MeliShippingOrderRow) {
  return brazilDateKey(row.ml_label_available_at)
}

/** Rótulo do método nos cards de próximos dias. */
export function meliShippingMethodLabel (row: MeliShippingOrderRow) {
  const named = String(row.ml_shipping_method || '').trim()
  if (named) return named
  const logistic = norm(row.ml_logistic_type)
  if (logistic === 'self_service') return 'Flex'
  if (logistic === 'fulfillment') return 'Full'
  if (logistic === 'drop_off' || logistic === 'xd_drop_off') return 'Agência Mercado Livre'
  return 'Mercado Envios'
}

/** Rótulo do método em Envios de hoje (Flex / Mercado Envios). */
export function meliShippingTodayMethodLabel (row: MeliShippingOrderRow) {
  const logistic = norm(row.ml_logistic_type)
  if (logistic === 'self_service') return 'Flex'
  if (logistic === 'fulfillment') return 'Full'
  return 'Mercado Envios'
}

function todayLaneForMethod (method: string): SalesLane {
  if (norm(method) === 'flex') return 'flex'
  return 'preparing'
}

/** Ainda não liberou para envio/impressão neste dia. */
function goesToUpcomingDays (
  readyDay: string | null,
  today: string,
  substatus: string,
) {
  if (substatus === 'buffered') return true
  if (!readyDay) return true
  return readyDay > today
}

type LineBucket = {
  title: string
  detail: string | null
  sortKey: string
  count: number
  lane: SalesLane
}

function toLines (buckets: Map<string, LineBucket>): MeliShippingCardLine[] {
  return [...buckets.values()]
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey)
      return a.title.localeCompare(b.title, 'pt-BR')
    })
    .map((bucket, index) => ({
      id: `line-${index}-${norm(bucket.title)}-${bucket.sortKey}`,
      title: bucket.title,
      detail: bucket.detail,
      count: bucket.count,
      lane: bucket.lane,
    }))
}

function bumpLine (
  buckets: Map<string, LineBucket>,
  input: {
    title: string
    detail: string | null
    sortKey: string
    lane: SalesLane
  },
) {
  const key = `${norm(input.title)}|${input.sortKey}`
  const current = buckets.get(key)
  if (current) {
    current.count += 1
    return
  }
  buckets.set(key, {
    title: input.title,
    detail: input.detail,
    sortKey: input.sortKey,
    count: 1,
    lane: input.lane,
  })
}

/**
 * Envios de hoje: liberação da etiqueta ≤ hoje.
 * Próximos dias: buffered, sem data ou data futura, agrupados por método + data.
 */
export function buildMeliShippingBoard (
  rows: MeliShippingOrderRow[],
  today = brazilTodayDateString(),
): MeliShippingBoard {
  let todayActive = 0
  let todayCanceled = 0
  let upcoming = 0
  let upcomingCanceled = 0
  let fullInProgress = 0
  let transit = 0
  let finished = 0
  const todayBuckets = new Map<string, LineBucket>()
  const upcomingBuckets = new Map<string, LineBucket>()

  for (const row of rows) {
    if (!String(row.ml_order_id || '').trim()) continue

    const status = norm(row.status)
    const logistic = norm(row.ml_logistic_type)
    const stage = norm(row.ml_fulfillment_stage)
    const shipStatus = norm(row.ml_shipment_status)
    const substatus = norm(row.ml_shipment_substatus)
    const isFull = logistic === 'fulfillment'
    const isCanceled = status === 'canceled' || status === 'cancelled'
      || shipStatus === 'cancelled' || shipStatus === 'canceled'
    const isDelivered = shipStatus === 'delivered'
    const isActive = status === 'paid' || status === 'in_progress'
    const readyDay = meliShipReadyDateKey(row)
    const isOpenStage = stage === 'preparing' || stage === 'pending_shipment'
    const isUpcoming = goesToUpcomingDays(readyDay, today, substatus)

    if (isDelivered) {
      finished += 1
      continue
    }

    if (isCanceled) {
      if (isOpenStage && !isFull) {
        if (isUpcoming) upcomingCanceled += 1
        else todayCanceled += 1
      } else {
        finished += 1
      }
      continue
    }

    if (!isActive) continue

    if (isFull && isOpenStage) {
      fullInProgress += 1
      continue
    }

    if (stage === 'shipped' || shipStatus === 'shipped') {
      transit += 1
      continue
    }

    if (!isOpenStage) continue

    if (isUpcoming) {
      upcoming += 1
      const method = meliShippingMethodLabel(row)
      const dayLabel = formatMeliShipReadyDayLabel(readyDay)
      bumpLine(upcomingBuckets, {
        title: method,
        detail: dayLabel,
        sortKey: readyDay || '9999-99-99',
        lane: 'pending_shipment',
      })
      continue
    }

    todayActive += 1
    const method = meliShippingTodayMethodLabel(row)
    const until = formatMeliPostingDeadlineUntil(row.ml_posting_deadline)
    bumpLine(todayBuckets, {
      title: method,
      detail: until,
      sortKey: `${until || 'zzz'}|${method}`,
      lane: todayLaneForMethod(method),
    })
  }

  const todayCount = todayActive + todayCanceled
  const upcomingCount = upcoming + upcomingCanceled
  const todayLines = toLines(todayBuckets)
  const upcomingLines = toLines(upcomingBuckets)

  const todayCards: MeliShippingCard[] = []
  if (todayActive > 0 || todayCanceled > 0) {
    todayCards.push({
      id: 'today-to-ship',
      section: 'to_ship',
      sectionLabel: 'Para enviar',
      title: 'Para enviar',
      subtitle: null,
      count: todayActive,
      footerLabel: todayCanceled > 0 ? 'Canceladas. Não enviar' : null,
      footerCount: todayCanceled,
      lane: todayLines.some((line) => line.lane === 'flex') ? 'flex' : 'preparing',
      lines: todayLines,
    })
  }
  if (fullInProgress > 0) {
    todayCards.push({
      id: 'today-full',
      section: 'in_progress',
      sectionLabel: 'Em andamento',
      title: 'Em andamento',
      subtitle: null,
      count: fullInProgress,
      footerLabel: null,
      footerCount: 0,
      lane: 'all',
      lines: [{
        id: 'today-full-line',
        title: 'Full',
        detail: 'No centro de distribuição',
        count: fullInProgress,
        lane: 'all',
      }],
    })
  }

  const upcomingCards: MeliShippingCard[] = []
  if (upcoming > 0 || upcomingCanceled > 0) {
    upcomingCards.push({
      id: 'upcoming-to-ship',
      section: 'to_ship',
      sectionLabel: 'Para enviar',
      title: 'Para enviar',
      subtitle: null,
      count: upcoming,
      footerLabel: upcomingCanceled > 0 ? 'Canceladas. Não enviar' : null,
      footerCount: upcomingCanceled,
      lane: 'pending_shipment',
      lines: upcomingLines,
    })
  }
  if (fullInProgress > 0) {
    upcomingCards.push({
      id: 'upcoming-full',
      section: 'in_progress',
      sectionLabel: 'Em andamento',
      title: 'Em andamento',
      subtitle: null,
      count: fullInProgress,
      footerLabel: null,
      footerCount: 0,
      lane: 'all',
      lines: [{
        id: 'upcoming-full-line',
        title: 'Full',
        detail: 'No centro de distribuição',
        count: fullInProgress,
        lane: 'all',
      }],
    })
  }

  return {
    tabs: [
      { id: 'today', label: 'Envios de hoje', count: todayCount, showCount: true, lane: 'preparing' },
      { id: 'upcoming', label: 'Próximos dias', count: upcomingCount, showCount: true, lane: 'pending_shipment' },
      { id: 'transit', label: 'Em trânsito', count: 0, showCount: false, lane: 'shipped' },
      { id: 'finished', label: 'Finalizadas', count: 0, showCount: false, lane: 'canceled' },
    ],
    cardsByTab: {
      today: todayCards,
      upcoming: upcomingCards,
      transit: [],
      finished: [],
    },
  }
}
