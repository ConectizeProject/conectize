'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-500',
  aguardando_aprovacao: 'bg-violet-500',
  aprovado: 'bg-blue-500',
  aguardando_pecas: 'bg-orange-500',
  em_manutencao: 'bg-indigo-500',
  aguardando_retirada: 'bg-emerald-500',
}

export type OrderWithStatus = {
  id: string
  display_number: string | null
  status: string
  title: string
}

type Props = {
  orders: OrderWithStatus[]
}

export function DashboardAguardandoPecasCard({ orders }: Props) {
  return (
    <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-orange-800 dark:text-orange-200">
          <Package className="h-4 w-4 shrink-0" />
          Aguardando peças
        </CardTitle>
        <CardDescription>
          OS aguardando peças para manutenção
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-orange-500/30 bg-orange-100/50 dark:bg-orange-900/20 px-3 py-2.5 text-center">
          <div className="text-2xl font-bold tabular-nums text-orange-900 dark:text-orange-100">{orders.length}</div>
          <p className="text-[11px] text-orange-700 dark:text-orange-300 uppercase tracking-wide mt-0.5">Aguardando peças</p>
        </div>
        {orders.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[o.status] ?? 'bg-muted'}`}
                  aria-hidden
                />
                <Link
                  href={`/portal/ordens/${o.id}`}
                  className="font-medium text-orange-900 dark:text-orange-100 hover:underline min-w-0 truncate"
                >
                  #{o.display_number ?? o.id.slice(0, 8)} — {o.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma OS aguardando peças</p>
        )}
        <Link
          href="/portal/ordens?statusGroup=open"
          className="text-xs font-medium text-orange-700 dark:text-orange-300 hover:underline inline-block pt-1"
        >
          Ver ordens →
        </Link>
      </CardContent>
    </Card>
  )
}
