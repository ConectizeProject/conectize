'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ReportDateRangeField } from '@/components/reports/ReportDateRangeField'

type PresetKey =
  | 'today'
  | 'last7'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30'
  | 'last60'
  | 'last90'
  | 'thisYear'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'last7', label: 'Últimos 7 dias' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: 'last30', label: 'Últimos 30 dias' },
  { key: 'last60', label: 'Últimos 60 dias' },
  { key: 'last90', label: 'Últimos 90 dias' },
  { key: 'thisYear', label: 'Este ano' },
]

type Props = {
  fromStr: string
  toStr: string
}

export function VendasAparelhosPeriodBar ({ fromStr, toStr }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  /** Mesmo fuso que `getCurrentMonthRangeOrSearch` na página (UTC em YYYY-MM-DD). */
  const nowUtc = new Date()

  function applyRange (from: string, to: string) {
    if (from === fromStr && to === toStr) return
    const params = new URLSearchParams()
    params.set('from', from)
    params.set('to', to)
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyPreset (preset: PresetKey) {
    const { from, to } = buildRange(nowUtc, preset)
    applyRange(from, to)
  }

  function isPresetActive (presetKey: PresetKey) {
    const { from, to } = buildRange(nowUtc, presetKey)
    return fromStr === from && toStr === to
  }

  return (
    <div className="-mx-1 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
        <span className="text-sm font-medium whitespace-nowrap text-foreground">Período</span>
        <ReportDateRangeField
          key={`${fromStr}-${toStr}`}
          defaultFrom={fromStr}
          defaultTo={toStr}
          className="shrink-0"
          onRangeChange={applyRange}
        />
      </div>

      <span className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            size="sm"
            variant={isPresetActive(preset.key) ? 'default' : 'outline'}
            onClick={() => applyPreset(preset.key)}
            className="h-8 shrink-0 whitespace-nowrap px-2.5 text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function buildRange (now: Date, preset: PresetKey) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const today = new Date(Date.UTC(y, m, d))

  if (preset === 'today') {
    return { from: formatYmdUtc(today), to: formatYmdUtc(today) }
  }

  if (preset === 'thisMonth') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    return { from: formatYmdUtc(from), to: formatYmdUtc(today) }
  }

  if (preset === 'lastMonth') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
    return { from: formatYmdUtc(from), to: formatYmdUtc(to) }
  }

  if (preset === 'thisYear') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
    return { from: formatYmdUtc(from), to: formatYmdUtc(today) }
  }

  if (preset === 'last7') return fromLastDaysUtc(today, 7)
  if (preset === 'last30') return fromLastDaysUtc(today, 30)
  if (preset === 'last60') return fromLastDaysUtc(today, 60)
  if (preset === 'last90') return fromLastDaysUtc(today, 90)

  return { from: formatYmdUtc(today), to: formatYmdUtc(today) }
}

function fromLastDaysUtc (today: Date, days: number) {
  const from = new Date(today)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return {
    from: formatYmdUtc(from),
    to: formatYmdUtc(today),
  }
}

function formatYmdUtc (date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
