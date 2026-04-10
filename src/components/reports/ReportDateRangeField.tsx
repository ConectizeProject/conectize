'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function parseYmd (str: string): Date | undefined {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? undefined : date
}

function formatYmd (date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function normalizeRange (r: DateRange | undefined): DateRange | undefined {
  if (!r?.from) return r
  const from = r.from
  const to = r.to
  if (to && from.getTime() > to.getTime()) {
    return { from: to, to: from }
  }
  return { from, to }
}

export type ReportDateRangeFieldProps = {
  defaultFrom?: string
  defaultTo?: string
  className?: string
  /** Nomes dos inputs hidden (apenas se não houver `onRangeChange`) */
  nameFrom?: string
  nameTo?: string
  /** Chamado quando o intervalo é definido (2º clique) ou ao fechar o popover (1 dia ou intervalo incompleto vira um dia). */
  onRangeChange?: (from: string, to: string) => void
}

export function ReportDateRangeField ({
  defaultFrom,
  defaultTo,
  className,
  nameFrom = 'from',
  nameTo = 'to',
  onRangeChange,
}: ReportDateRangeFieldProps) {
  const fromInitial = parseYmd(defaultFrom ?? '')
  const toInitial = parseYmd(defaultTo ?? '')
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateRange>(() => {
    if (fromInitial && toInitial) return { from: fromInitial, to: toInitial }
    if (fromInitial) return { from: fromInitial }
    return {} as DateRange
  })

  const rangeRef = React.useRef(range)
  React.useEffect(() => {
    rangeRef.current = range
  }, [range])

  const lastEmittedRef = React.useRef<string>('')

  React.useEffect(() => {
    lastEmittedRef.current = ''
  }, [defaultFrom, defaultTo])

  const fromStr = range.from ? formatYmd(range.from) : ''
  const toStr = range.to
    ? formatYmd(range.to)
    : range.from
      ? formatYmd(range.from)
      : ''

  const displayLabel = range.from
    ? range.to && range.from.getTime() !== range.to.getTime()
      ? `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} — ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`
      : format(range.from, 'dd/MM/yyyy', { locale: ptBR })
    : 'De / até'

  function emitRange (fromS: string, toS: string) {
    if (!onRangeChange) return
    const defFrom = defaultFrom ?? ''
    const defTo = defaultTo ?? ''
    if (fromS === defFrom && toS === defTo) return
    const key = `${fromS}|${toS}`
    if (lastEmittedRef.current === key) return
    lastEmittedRef.current = key
    onRangeChange(fromS, toS)
  }

  function handleSelect (next: DateRange | undefined) {
    const n = normalizeRange(next) ?? ({} as DateRange)
    rangeRef.current = n
    setRange(n)
    if (!onRangeChange || !n.from) return
    if (n.to !== undefined) {
      emitRange(formatYmd(n.from), formatYmd(n.to))
    }
  }

  return (
    <div className={cn('inline-flex', className)}>
      {!onRangeChange && (
        <>
          <input type="hidden" name={nameFrom} value={fromStr} readOnly />
          <input type="hidden" name={nameTo} value={toStr} readOnly />
        </>
      )}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next && onRangeChange && open) {
            const r = rangeRef.current
            if (r.from) {
              const fromS = formatYmd(r.from)
              const toS = r.to ? formatYmd(r.to) : fromS
              emitRange(fromS, toS)
            }
          }
          setOpen(next)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-[200px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range.from ? { from: range.from, to: range.to } : undefined}
            onSelect={handleSelect}
            numberOfMonths={2}
            defaultMonth={range.from ?? new Date()}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
