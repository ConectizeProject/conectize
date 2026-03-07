'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DateRange = { from?: Date; to?: Date }

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

function buildRange (now: Date, preset: PresetKey): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const formatYmd = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  if (preset === 'today') return { from: formatYmd(today), to: formatYmd(today) }
  if (preset === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: formatYmd(from), to: formatYmd(today) }
  }
  if (preset === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: formatYmd(from), to: formatYmd(to) }
  }
  if (preset === 'thisYear') {
    const from = new Date(today.getFullYear(), 0, 1)
    return { from: formatYmd(from), to: formatYmd(today) }
  }
  if (preset === 'last90' || preset === 'last180' || preset === 'last360') {
    const days = preset === 'last90' ? 90 : preset === 'last180' ? 180 : 360
    const from = new Date(today)
    from.setDate(from.getDate() - (days - 1))
    return { from: formatYmd(from), to: formatYmd(today) }
  }
  return { from: formatYmd(today), to: formatYmd(today) }
}

function parseYmd (str: string): Date | undefined {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? undefined : date
}

function formatYmd (date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type DateRangePickerProps = {
  defaultFrom?: string
  defaultTo?: string
  className?: string
  /** Nomes dos inputs hidden para envio no form (ex: "from" e "to") */
  nameFrom?: string
  nameTo?: string
}

export function DateRangePicker ({
  defaultFrom,
  defaultTo,
  className,
  nameFrom = 'from',
  nameTo = 'to',
}: DateRangePickerProps) {
  const fromInitial = parseYmd(defaultFrom ?? '')
  const toInitial = parseYmd(defaultTo ?? '')
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateRange>(() => {
    if (fromInitial && toInitial) return { from: fromInitial, to: toInitial }
    if (fromInitial) return { from: fromInitial }
    return {}
  })

  const fromStr = range.from ? formatYmd(range.from) : ''
  const toStr = range.to ? formatYmd(range.to) : range.from ? formatYmd(range.from) : ''
  const displayLabel = range.from
    ? range.to && range.from.getTime() !== range.to.getTime()
      ? `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`
      : format(range.from, 'dd/MM/yyyy', { locale: ptBR })
    : 'Selecionar período'

  function handlePreset (presetKey: PresetKey) {
    const now = new Date()
    const { from, to } = buildRange(now, presetKey)
    const fromDate = parseYmd(from)
    const toDate = parseYmd(to)
    if (fromDate && toDate) {
      setRange({ from: fromDate, to: toDate })
      setOpen(false)
    }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <input type="hidden" name={nameFrom} value={fromStr} readOnly />
      <input type="hidden" name={nameTo} value={toStr} readOnly />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="border-b sm:border-b-0 sm:border-r p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Atalhos</p>
              <div className="flex flex-col gap-1">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 justify-start text-xs"
                    onClick={() => handlePreset(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-3">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => setRange(r ?? {})}
                numberOfMonths={2}
                defaultMonth={range.from ?? new Date()}
                locale={ptBR}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
