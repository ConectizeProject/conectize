'use client'

import { Filter, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import { SALES_LANE_OPTIONS, type SalesLane } from '@/lib/vendas/sales-lane'
import type {
  MeliShippingBoard,
  MeliShippingTabId,
} from '@/lib/vendas/meli-shipping-board'
import { cn } from '@/lib/utils'

type DayPoint = {
  day: string
  count: number
  totalCents: number
}

type MonthSummary = {
  count: number
  totalCents: number
  days: DayPoint[]
  startDate?: string
  endDate?: string
  label?: string
}

type Summary = {
  current: MonthSummary
  previous: MonthSummary
}

type MetricKind = 'count' | 'money'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function dayParts (isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  return { year, month, day }
}

function formatDayLabel (isoDate: string) {
  const parts = dayParts(isoDate)
  if (!parts) return isoDate
  return `Dia ${parts.day} de ${MONTH_NAMES[parts.month - 1]}`
}

function formatPeriodLabel (startIso: string, endIso: string) {
  const start = dayParts(startIso)
  const end = dayParts(endIso)
  if (!start || !end) return `${startIso} a ${endIso}`
  if (start.month === end.month && start.year === end.year) {
    return `período de ${start.day} a ${end.day} de ${MONTH_NAMES[end.month - 1]}`
  }
  return `período de ${start.day}/${start.month} a ${end.day}/${end.month}`
}

function metricValue (point: DayPoint | null | undefined, kind: MetricKind) {
  if (!point) return 0
  return kind === 'count' ? point.count : point.totalCents
}

function formatMetric (value: number, kind: MetricKind) {
  if (kind === 'count') return value.toLocaleString('pt-BR')
  return `R$ ${maskedFromCents(value)}`
}

function percentChange (current: number, previous: number) {
  if (previous <= 0) {
    if (current <= 0) return null
    return 100
  }
  return Math.round(((current - previous) / previous) * 100)
}

function sumThroughIndex (days: DayPoint[], index: number, kind: MetricKind) {
  let total = 0
  const end = Math.min(index, days.length - 1)
  for (let i = 0; i <= end; i += 1) {
    total += metricValue(days[i], kind)
  }
  return total
}

function ChangePill ({ percent }: { percent: number | null }) {
  if (percent == null) return null
  const isUp = percent >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums',
        isUp
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-500/15 text-red-700 dark:text-red-300',
      )}
    >
      {isUp
        ? <TrendingUp className='h-3 w-3' aria-hidden='true' />
        : <TrendingDown className='h-3 w-3' aria-hidden='true' />}
      {Math.abs(percent)}%
    </span>
  )
}

function MonthBars ({
  days,
  kind,
  max,
  label,
  activeIndex,
  onHover,
  onLeave,
  barClassName,
}: {
  days: DayPoint[]
  kind: MetricKind
  max: number
  label: string
  activeIndex: number | null
  onHover: (index: number) => void
  onLeave: () => void
  barClassName: string
}) {
  return (
    <div
      className='flex h-16 items-end gap-px'
      role='img'
      aria-label={label}
      onMouseLeave={onLeave}
    >
      {days.map((point, index) => {
        const value = metricValue(point, kind)
        const height = Math.max(
          value > 0 ? 14 : 4,
          Math.round((value / Math.max(1, max)) * 100),
        )
        const active = activeIndex === index
        return (
          <button
            key={point.day}
            type='button'
            className={cn(
              'min-w-0 flex-1 rounded-[1px] transition-[filter,opacity]',
              barClassName,
              active ? 'opacity-100 brightness-75' : 'opacity-85 hover:brightness-75',
            )}
            style={{ height: `${height}%` }}
            aria-label={`${formatDayLabel(point.day)}: ${formatMetric(value, kind)}`}
            onMouseEnter={() => onHover(index)}
            onFocus={() => onHover(index)}
            onBlur={onLeave}
          />
        )
      })}
    </div>
  )
}

function ComparisonTooltip ({
  id,
  kind,
  dayIndex,
  barCount,
  currentDays,
  previousDays,
}: {
  id?: string
  kind: MetricKind
  dayIndex: number
  barCount: number
  currentDays: DayPoint[]
  previousDays: DayPoint[]
}) {
  const currentDay = currentDays[dayIndex] ?? null
  const previousDay = previousDays[dayIndex] ?? null
  if (!currentDay && !previousDay) return null

  const currentValue = metricValue(currentDay, kind)
  const previousValue = metricValue(previousDay, kind)
  const dayPercent = percentChange(currentValue, previousValue)

  const currentPeriod = sumThroughIndex(currentDays, dayIndex, kind)
  const previousPeriod = sumThroughIndex(previousDays, dayIndex, kind)
  const periodPercent = percentChange(currentPeriod, previousPeriod)

  const currentStart = currentDays[0]?.day
  const previousStart = previousDays[0]?.day
  const safeCount = Math.max(1, barCount)
  const ratio = (dayIndex + 0.5) / safeCount
  // Nas laterais, ancora a caixa pra dentro do grafico (evita corte na pagina).
  const edgeAlign = ratio <= 0.22 ? 'start' : ratio >= 0.78 ? 'end' : 'center'
  const positionStyle = edgeAlign === 'start'
    ? { left: '0', transform: 'translateX(0)' }
    : edgeAlign === 'end'
      ? { left: '100%', transform: 'translateX(-100%)' }
      : { left: `${ratio * 100}%`, transform: 'translateX(-50%)' }

  return (
    <div
      id={id}
      role='tooltip'
      className='pointer-events-none absolute top-[calc(100%-0.25rem)] z-30 w-[min(17rem,100%)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg'
      style={positionStyle}
    >
      <div className='space-y-2 text-sm'>
        {currentDay ? (
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='text-xs text-muted-foreground'>{formatDayLabel(currentDay.day)}</p>
              <p className='font-semibold tabular-nums'>{formatMetric(currentValue, kind)}</p>
            </div>
            <ChangePill percent={dayPercent} />
          </div>
        ) : null}
        {previousDay ? (
          <div className='border-t border-border/70 pt-2'>
            <p className='text-xs text-muted-foreground'>{formatDayLabel(previousDay.day)}</p>
            <p className='font-semibold tabular-nums'>{formatMetric(previousValue, kind)}</p>
          </div>
        ) : null}
        {currentDay && currentStart ? (
          <div className='flex items-start justify-between gap-3 border-t border-border/70 pt-2'>
            <div>
              <p className='text-xs text-muted-foreground'>
                {formatPeriodLabel(currentStart, currentDay.day)}
              </p>
              <p className='font-semibold tabular-nums'>{formatMetric(currentPeriod, kind)}</p>
            </div>
            <ChangePill percent={periodPercent} />
          </div>
        ) : null}
        {previousDay && previousStart ? (
          <div className='border-t border-border/70 pt-2'>
            <p className='text-xs text-muted-foreground'>
              {formatPeriodLabel(previousStart, previousDay.day)}
            </p>
            <p className='font-semibold tabular-nums'>{formatMetric(previousPeriod, kind)}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SummaryCard ({
  title,
  kind,
  summary,
}: {
  title: string
  kind: MetricKind
  summary: Summary | null
}) {
  const tooltipId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverSide, setHoverSide] = useState<'previous' | 'current' | null>(null)

  const previousDays = summary?.previous.days ?? []
  const currentDays = summary?.current.days ?? []

  const max = useMemo(() => {
    const values = [
      ...previousDays.map((day) => metricValue(day, kind)),
      ...currentDays.map((day) => metricValue(day, kind)),
    ]
    return Math.max(1, ...values, 0)
  }, [previousDays, currentDays, kind])

  const activeIndex = hoverIndex
  const showTooltip = activeIndex != null && hoverSide != null

  return (
    <Card className='overflow-visible'>
      <CardContent className='space-y-3 overflow-visible p-4'>
        <p className='text-sm text-muted-foreground'>{title}</p>
        <div
          className='relative z-10'
          onMouseLeave={() => {
            setHoverIndex(null)
            setHoverSide(null)
          }}
        >
          <div className='grid gap-4 sm:grid-cols-2 sm:gap-0'>
            <div className='space-y-2 sm:pr-4'>
              <div>
                <p className='text-xs text-muted-foreground'>Mês passado</p>
                <p className='text-xl font-semibold tabular-nums'>
                  {summary
                    ? formatMetric(
                      kind === 'count' ? summary.previous.count : summary.previous.totalCents,
                      kind,
                    )
                    : '...'}
                </p>
              </div>
              <div className='relative'>
                <MonthBars
                  days={previousDays.length > 0 ? previousDays : [{ day: 'prev', count: 0, totalCents: 0 }]}
                  kind={kind}
                  max={max}
                  label={`${title}: mês passado`}
                  activeIndex={hoverSide === 'previous' ? hoverIndex : null}
                  onHover={(index) => {
                    setHoverSide('previous')
                    setHoverIndex(index)
                  }}
                  onLeave={() => {}}
                  barClassName='bg-violet-400/80 dark:bg-violet-500/70'
                />
                {showTooltip && hoverSide === 'previous' && activeIndex != null ? (
                  <ComparisonTooltip
                    id={tooltipId}
                    kind={kind}
                    dayIndex={activeIndex}
                    barCount={previousDays.length || 1}
                    currentDays={currentDays}
                    previousDays={previousDays}
                  />
                ) : null}
              </div>
            </div>

            <div className='space-y-2 border-border/70 sm:border-l sm:pl-4'>
              <div>
                <p className='text-xs text-muted-foreground'>Mês atual</p>
                <p className='text-xl font-semibold tabular-nums'>
                  {summary
                    ? formatMetric(
                      kind === 'count' ? summary.current.count : summary.current.totalCents,
                      kind,
                    )
                    : '...'}
                </p>
              </div>
              <div className='relative'>
                <MonthBars
                  days={currentDays.length > 0 ? currentDays : [{ day: 'curr', count: 0, totalCents: 0 }]}
                  kind={kind}
                  max={max}
                  label={`${title}: mês atual`}
                  activeIndex={hoverSide === 'current' ? hoverIndex : null}
                  onHover={(index) => {
                    setHoverSide('current')
                    setHoverIndex(index)
                  }}
                  onLeave={() => {}}
                  barClassName='bg-primary/80'
                />
                {showTooltip && hoverSide === 'current' && activeIndex != null ? (
                  <ComparisonTooltip
                    id={tooltipId}
                    kind={kind}
                    dayIndex={activeIndex}
                    barCount={currentDays.length || 1}
                    currentDays={currentDays}
                    previousDays={previousDays}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ShippingBoardSkeleton () {
  return (
    <div className='space-y-3' aria-busy='true' aria-label='Carregando envios'>
      <div className='flex gap-2 overflow-hidden'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-9 w-28 shrink-0 rounded-full' />
        ))}
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className='space-y-2 rounded-xl border border-border/40 bg-white px-4 py-3 dark:bg-card'>
            <div className='flex items-center justify-between gap-2'>
              <Skeleton className='h-3 w-20' />
              <Skeleton className='h-5 w-5 rounded-full' />
            </div>
            <Skeleton className='h-5 w-36' />
            <Skeleton className='h-4 w-16' />
          </div>
        ))}
      </div>
    </div>
  )
}

function ShippingBoard ({
  board,
  loading,
  activeTab,
  onTabChange,
  onCardSelect,
}: {
  board: MeliShippingBoard | null
  loading: boolean
  activeTab: MeliShippingTabId
  onTabChange: (tab: MeliShippingTabId) => void
  onCardSelect: (lane: SalesLane) => void
}) {
  if (loading) return <ShippingBoardSkeleton />
  if (!board) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        Não foi possível carregar o painel de envios.
      </p>
    )
  }

  const tabs = board.tabs
  const cards = board.cardsByTab[activeTab] ?? []

  return (
    <div className='space-y-3'>
      <div
        className='inline-flex max-w-full overflow-x-auto rounded-full bg-muted p-1'
        role='tablist'
        aria-label='Envios Mercado Livre'
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={selected}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                selected
                  ? 'bg-background font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onTabChange(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.showCount && tab.count > 0 ? (
                <span className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
                  selected
                    ? 'bg-sky-600 text-white'
                    : 'bg-sky-600/90 text-white',
                )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {cards.length === 0 ? (
          <div className='rounded-xl border border-dashed border-border/70 bg-white px-4 py-5 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4 dark:bg-card'>
            Nenhum envio nesta etapa no momento.
          </div>
        ) : cards.map((card) => (
          <div
            key={card.id}
            className='rounded-xl border border-border/60 bg-white px-4 py-3 dark:bg-card'
          >
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-semibold text-foreground'>
                {card.sectionLabel}
              </p>
              <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-xs font-semibold text-foreground'>
                {card.count}
              </span>
            </div>

            {card.lines.length > 0 ? (
              <ul className='mt-2 space-y-1.5'>
                {card.lines.map((line) => (
                  <li key={line.id}>
                    <button
                      type='button'
                      onClick={() => onCardSelect(line.lane)}
                      className='flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50'
                    >
                      <span className='min-w-0 text-sm text-foreground'>
                        <span className='font-medium'>{line.title}</span>
                        {line.detail ? (
                          <span className='text-muted-foreground'>
                            {' '}
                            |
                            {' '}
                            {line.detail}
                          </span>
                        ) : null}
                      </span>
                      <span className='inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/10 px-1 text-xs font-semibold text-foreground'>
                        {line.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type='button'
                onClick={() => onCardSelect(card.lane)}
                className='mt-2 w-full text-left'
              >
                <p className='text-base font-semibold text-foreground'>{card.title}</p>
                {card.subtitle ? (
                  <p className='mt-0.5 text-sm text-muted-foreground'>{card.subtitle}</p>
                ) : null}
              </button>
            )}

            {card.footerLabel && card.footerCount > 0 ? (
              <button
                type='button'
                onClick={() => onCardSelect('canceled')}
                className='mt-3 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50'
              >
                <span>{card.footerLabel}</span>
                <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/15 px-1 text-xs font-semibold text-rose-700 dark:text-rose-300'>
                  {card.footerCount}
                </span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function tabFromLane (lane: SalesLane): MeliShippingTabId {
  if (lane === 'preparing' || lane === 'flex') return 'today'
  if (lane === 'pending_shipment') return 'upcoming'
  if (lane === 'shipped') return 'transit'
  if (lane === 'canceled') return 'finished'
  return 'today'
}

export function VendasRealizadasHeader ({
  lane,
  onLaneChange,
  filtersOpen,
  onToggleFilters,
}: {
  lane: SalesLane
  onLaneChange: (lane: SalesLane) => void
  filtersOpen: boolean
  onToggleFilters: () => void
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [shippingBoard, setShippingBoard] = useState<MeliShippingBoard | null>(null)
  const [showShippingBoard, setShowShippingBoard] = useState(false)
  const [shippingLoading, setShippingLoading] = useState(true)
  const [shippingTab, setShippingTab] = useState<MeliShippingTabId>(() => tabFromLane(lane))

  useEffect(() => {
    setShippingTab(tabFromLane(lane))
  }, [lane])

  useEffect(() => {
    let cancelled = false
    async function load () {
      setShippingLoading(true)
      const res = await portalFetch('/api/portal/sales-orders/summary')
      const data = await res?.json().catch(() => null)
      if (cancelled) return
      if (!data?.ok) {
        setShippingLoading(false)
        return
      }
      const previousDays = Array.isArray(data.previous?.days) ? data.previous.days : []
      const currentDays = Array.isArray(data.current?.days) ? data.current.days : []
      setSummary({
        current: {
          count: Number(data.current?.count) || 0,
          totalCents: Number(data.current?.totalCents) || 0,
          days: currentDays,
          startDate: data.current?.startDate,
          endDate: data.current?.endDate,
          label: data.current?.label,
        },
        previous: {
          count: Number(data.previous?.count) || 0,
          totalCents: Number(data.previous?.totalCents) || 0,
          days: previousDays,
          startDate: data.previous?.startDate,
          endDate: data.previous?.endDate,
          label: data.previous?.label,
        },
      })
      const showBoard = data.showShippingBoard === true
      setShowShippingBoard(showBoard)
      if (showBoard && data.shippingBoard?.tabs && data.shippingBoard?.cardsByTab) {
        setShippingBoard(data.shippingBoard as MeliShippingBoard)
      } else {
        setShippingBoard(null)
      }
      setShippingLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className='space-y-3'>
      <div className='grid gap-3 md:grid-cols-2'>
        <SummaryCard
          title='Vendas aprovadas (qtd)'
          kind='count'
          summary={summary}
        />
        <SummaryCard
          title='Vendas aprovadas (R$)'
          kind='money'
          summary={summary}
        />
      </div>

      {showShippingBoard ? (
        <Card className='overflow-visible border-0 bg-muted/50 shadow-none'>
          <CardContent className='space-y-3 p-4'>
            <ShippingBoard
              board={shippingBoard}
              loading={shippingLoading}
              activeTab={shippingTab}
              onTabChange={(tab) => {
                setShippingTab(tab)
                const match = shippingBoard?.tabs.find((item) => item.id === tab)
                onLaneChange(match?.lane ?? 'all')
              }}
              onCardSelect={onLaneChange}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className='flex items-center overflow-x-auto pb-1'>
        <button
          type='button'
          aria-pressed={filtersOpen}
          aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          className='mr-6 inline-flex h-9 w-9 shrink-0 items-center justify-center bg-transparent text-foreground hover:text-primary'
          onClick={onToggleFilters}
        >
          <Filter className='h-4 w-4' aria-hidden='true' />
        </button>
        <div className='flex gap-2' role='tablist' aria-label='Etapas das vendas'>
          {SALES_LANE_OPTIONS.map((option) => {
            const selected = lane === option.id
            return (
              <button
                key={option.id}
                type='button'
                role='tab'
                aria-selected={selected}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
                onClick={() => onLaneChange(option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
