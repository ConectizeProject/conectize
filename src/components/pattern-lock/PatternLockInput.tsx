'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}

function parseValue(value: string) {
  return String(value || '')
    .split('-')
    .map(s => Number.parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
}

export function PatternLockInput(props: Props) {
  const [isDrawing, setIsDrawing] = useState(false)

  const selected = useMemo(() => {
    return parseValue(String(props.value || ''))
  }, [props.value])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  function emit(next: number[]) {
    if (!props.onChange) return
    props.onChange(next.join('-'))
  }

  function addDot(dot: number) {
    if (props.disabled) return
    const last = selected[selected.length - 1]
    if (last === dot) return
    emit(selected.concat(dot))
  }

  function clear() {
    if (props.disabled) return
    emit([])
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'grid grid-cols-3 gap-2 w-[156px] select-none touch-none',
          props.disabled ? 'opacity-60 pointer-events-none' : ''
        )}
        onPointerUp={() => setIsDrawing(false)}
        onPointerCancel={() => setIsDrawing(false)}
        onPointerLeave={() => setIsDrawing(false)}
      >
        {Array.from({ length: 9 }).map((_, idx) => {
          const dot = idx + 1
          const isSelected = selectedSet.has(dot)
          return (
            <button
              key={dot}
              type="button"
              className={cn(
                'h-12 w-12 rounded-md border flex items-center justify-center text-sm font-medium',
                isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent/30'
              )}
              onPointerDown={(e) => {
                if (props.disabled) return
                e.currentTarget.setPointerCapture(e.pointerId)
                setIsDrawing(true)
                addDot(dot)
              }}
              onPointerEnter={() => {
                if (!isDrawing) return
                addDot(dot)
              }}
            >
              {dot}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">
          {selected.length > 0 ? `Padrão: ${selected.join('-')}` : 'Desenhe um padrão (1–9)'}
        </div>
        <div className="flex-1" />
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={props.disabled || selected.length === 0}>
          Limpar
        </Button>
      </div>
    </div>
  )
}

