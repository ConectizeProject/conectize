'use client'

import { maskedFromCents } from '@/lib/utils/money'

export type SituacaoItem = {
  label: string
  count: number
  totalCents: number
  barColor: string
}

type Props = {
  items: SituacaoItem[]
  totalCount: number
}

export function RelatorioServicosSituacao({ items, totalCount }: Props) {
  if (totalCount === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 h-full min-h-[260px] flex flex-col">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Situação</h3>
        <p className="text-sm text-muted-foreground">Nenhuma ordem fechada no período.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 h-full min-h-[260px] flex flex-col">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Situação</h3>
      <div className="space-y-4 flex-1">
        {items.map((item) => {
          const pct = totalCount > 0 ? (item.count / totalCount) * 100 : 0
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between items-baseline text-sm">
                <span className="font-medium text-foreground">
                  {item.label} ({item.count}/{totalCount})
                </span>
                <span className="tabular-nums text-muted-foreground">
                  R$ {maskedFromCents(item.totalCents)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: item.barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
