import Link from 'next/link'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-500',
  aguardando_aprovacao: 'bg-violet-500',
  aprovado: 'bg-blue-500',
  aguardando_pecas: 'bg-orange-500',
  em_manutencao: 'bg-indigo-500',
  aguardando_retirada: 'bg-emerald-500',
}

export type OrderLink = {
  id: string
  display_number: string | null
  title: string
  status: string
}

type Props = {
  orders: OrderLink[]
}

export function DashboardAlertaVermelhoCard({ orders }: Props) {
  return (
    <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20 dark:border-red-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-red-800 dark:text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Atrasadas ou há mais de 1 dia útil
        </CardTitle>
        <CardDescription>
          OS com prazo vencido ou abertas há mais de um dia útil
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-red-500/30 bg-red-100/50 dark:bg-red-900/20 px-3 py-2.5 text-center">
          <div className="text-2xl font-bold tabular-nums text-red-900 dark:text-red-100">{orders.length}</div>
          <p className="text-[11px] text-red-700 dark:text-red-300 uppercase tracking-wide mt-0.5">Atrasadas ou &gt;1 dia útil</p>
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
                  href={getOrdemPortalPath(o)}
                  className="font-medium text-red-900 dark:text-red-100 hover:underline min-w-0 truncate"
                >
                  #{o.display_number ?? o.id.slice(0, 8)} — {o.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma OS neste critério</p>
        )}
        <Link
          href="/portal/ordens?statusGroup=open"
          className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
        >
          Ver ordens →
        </Link>
      </CardContent>
    </Card>
  )
}
