'use client'

import { cn } from '@/lib/utils'

/** Placeholder leve no alvo do drop (menos nós que antes = menos custo durante o drag). */
export function OrdensKanbanDropSkeleton ({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none min-h-[188px] w-full animate-pulse rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/45 p-3',
        className,
      )}
      aria-hidden
    >
      <div className="h-3 w-1/3 rounded bg-muted-foreground/15" />
      <div className="mt-2 h-3 w-[92%] rounded bg-muted-foreground/12" />
      <div className="mt-4 h-20 w-full rounded bg-muted-foreground/10" />
    </div>
  )
}
