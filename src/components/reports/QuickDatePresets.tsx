'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

type PresetKey =
  | 'today'
  | 'thisMonth'
  | 'lastMonth'
  | 'last90'
  | 'last180'
  | 'thisYear'
  | 'last360'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: 'last90', label: 'Últimos 90 dias' },
  { key: 'last180', label: 'Últimos 180 dias' },
  { key: 'thisYear', label: 'Este ano' },
  { key: 'last360', label: 'Últimos 360 dias' },
]

export function QuickDatePresets () {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fromParam = searchParams?.get('from') ?? ''
  const toParam = searchParams?.get('to') ?? ''

  function handleClick (preset: PresetKey) {
    const now = new Date()
    const { from, to } = buildRange(now, preset)

    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('from', from)
    params.set('to', to)

    router.push(`${pathname}?${params.toString()}`)
  }

  const now = new Date()
  function isPresetActive (presetKey: PresetKey) {
    const { from, to } = buildRange(now, presetKey)
    return fromParam === from && toParam === to
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-xs text-muted-foreground">
        Atalhos rápidos:
      </span>
      {PRESETS.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          size="sm"
          variant={isPresetActive(preset.key) ? 'default' : 'outline'}
          onClick={() => handleClick(preset.key)}
          className="h-7 px-2 text-xs"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}

function buildRange (now: Date, preset: PresetKey) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    return {
      from: formatYmd(today),
      to: formatYmd(today),
    }
  }

  if (preset === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return {
      from: formatYmd(from),
      to: formatYmd(today),
    }
  }

  if (preset === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      from: formatYmd(from),
      to: formatYmd(to),
    }
  }

  if (preset === 'thisYear') {
    const from = new Date(today.getFullYear(), 0, 1)
    return {
      from: formatYmd(from),
      to: formatYmd(today),
    }
  }

  if (preset === 'last90') {
    return fromLastDays(today, 90)
  }

  if (preset === 'last180') {
    return fromLastDays(today, 180)
  }

  if (preset === 'last360') {
    return fromLastDays(today, 360)
  }

  return {
    from: formatYmd(today),
    to: formatYmd(today),
  }
}

function fromLastDays (today: Date, days: number) {
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return {
    from: formatYmd(from),
    to: formatYmd(today),
  }
}

function formatYmd (date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

