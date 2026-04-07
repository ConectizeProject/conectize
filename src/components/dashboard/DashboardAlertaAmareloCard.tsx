import Link from 'next/link'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

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

export function DashboardAlertaAmareloCard({ orders }: Props) {
  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Próximas do prazo
        </CardTitle>
        <CardDescription>
          OS a até 30 min do horário previsto de entrega
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-100/50 dark:bg-amber-900/20 px-3 py-2.5 text-center">
          <div className="text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-100">{orders.length}</div>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 uppercase tracking-wide mt-0.5">Próximas do prazo</p>
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
                  className="font-medium text-amber-900 dark:text-amber-100 hover:underline min-w-0 truncate"
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
          className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
        >
          Ver ordens →
        </Link>
      </CardContent>
    </Card>
  )
}
