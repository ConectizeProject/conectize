'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getOrderStatusLabel } from '@/lib/orders/order-status'

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-500',
  aguardando_aprovacao: 'bg-violet-500',
  aprovado: 'bg-blue-500',
  aguardando_pecas: 'bg-orange-500',
  em_manutencao: 'bg-indigo-500',
  aguardando_retirada: 'bg-emerald-500',
}

export type OpenOrder = {
  id: string
  display_number: string | null
  status: string
  title: string
}

type Props = {
  total: number
  orders: OpenOrder[]
  statusCounts: Record<string, number>
}

export function DashboardOsAtivasCard({ total, orders, statusCounts }: Props) {
  const statusEntries = Object.entries(statusCounts).filter(([, n]) => n > 0)
  const tooltipText = statusEntries.length > 0
    ? statusEntries.map(([status, n]) => `${getOrderStatusLabel(status)}: ${n}`).join(' · ')
    : null

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">OS ativas</CardTitle>
          <CardDescription>Ordens de serviço abertas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/50 px-3 py-2.5 text-center">
            <div className="text-2xl font-bold tabular-nums">{total}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">Ordens abertas</p>
          </div>
          {orders.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {orders.slice(0, 12).map((o) => {
                const dotClass = STATUS_DOT_CLASSES[o.status] ?? 'bg-muted'
                const label = getOrderStatusLabel(o.status)
                return (
                  <li key={o.id} className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
                          aria-hidden
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                    <Link
                      href={`/portal/ordens/${o.id}`}
                      className="min-w-0 truncate hover:underline font-medium"
                    >
                      #{o.display_number ?? o.id.slice(0, 8)} — {o.title}
                    </Link>
                  </li>
                )
              })}
              {orders.length > 12 && (
                <li className="text-xs text-muted-foreground pl-4">
                  +{orders.length - 12} mais
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma OS ativa</p>
          )}
          {tooltipText && (
            <p className="text-[10px] text-muted-foreground" title={tooltipText}>
              Por status: {statusEntries.map(([s, n]) => `${getOrderStatusLabel(s)} ${n}`).join(', ')}
            </p>
          )}
          <div className="flex flex-row gap-2 pt-1 justify-start items-center">
            <Link
              href="/portal/ordens?statusGroup=open"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver ordens →
            </Link>
            <Link
              href="/portal/ordens/nova"
              className="text-xs font-medium text-primary hover:underline"
            >
              Nova ordem →
            </Link>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
