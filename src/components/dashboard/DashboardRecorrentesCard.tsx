import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock } from 'lucide-react'
import { maskedFromCents } from '@/lib/utils/money'
import type { RecurringPendingDto } from '@/lib/finance/recurring-due'

type Props = {
  items: RecurringPendingDto[]
}

function statusBadgeClass (daysUntil: number): string {
  if (daysUntil < 0) return 'bg-red-600 text-white dark:bg-red-700'
  if (daysUntil === 0) return 'bg-orange-600 text-white dark:bg-orange-700'
  if (daysUntil <= 2) return 'bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
  return 'bg-sky-600 text-white dark:bg-sky-700'
}

export function DashboardRecorrentesCard ({ items }: Props) {
  return (
    <Card className="border-sky-500/40 bg-sky-50/40 dark:bg-sky-950/25 dark:border-sky-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-sky-900 dark:text-sky-100">
          <CalendarClock className="h-4 w-4 shrink-0" />
          Contas recorrentes
        </CardTitle>
        <CardDescription>
          Competência no mês atual ou vencimento em até 3 dias (administradores)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-sky-500/30 bg-sky-100/50 dark:bg-sky-900/30 px-3 py-2.5 text-center">
          <div className="text-2xl font-bold tabular-nums text-sky-900 dark:text-sky-100">{items.length}</div>
          <p className="text-[11px] text-sky-700 dark:text-sky-300 uppercase tracking-wide mt-0.5">Atenção ao vencimento</p>
        </div>
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {items.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-md border border-sky-500/20 bg-white/60 dark:bg-sky-950/40 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sky-950 dark:text-sky-50 min-w-0 leading-tight">{p.description}</span>
                  <span className="shrink-0 text-xs font-medium text-red-700 dark:text-red-300 tabular-nums">
                    {maskedFromCents(-Math.abs(p.amount_cents))}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(p.days_until)}`}>
                    {p.status_label}
                  </span>
                  {p.conta_name ? <span>{p.conta_name}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma conta recorrente neste critério</p>
        )}
        <Link
          href="/portal/financeiro"
          className="text-xs font-medium text-sky-800 dark:text-sky-200 hover:underline"
        >
          Ir para o financeiro →
        </Link>
      </CardContent>
    </Card>
  )
}
