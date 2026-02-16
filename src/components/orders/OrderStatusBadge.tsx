import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
  finalizada: 'Finalizada',
  finalizada_sem_conserto: 'Finalizada sem conserto',
  finalizada_sem_aprovacao: 'Finalizada sem aprovação',
  cancelada: 'Cancelada',
}

const STATUS_CLASSES: Record<string, string> = {
  orcamento: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  aprovado: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  aguardando_pecas: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  em_manutencao: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  aguardando_retirada: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  finalizada: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300',
  finalizada_sem_conserto: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
  finalizada_sem_aprovacao: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400',
  cancelada: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
}

type Props = {
  status: string
  className?: string
}

export function OrderStatusBadge({ status, className }: Props) {
  const label = STATUS_LABELS[status] ?? status
  const statusClasses = STATUS_CLASSES[status] ?? 'border-transparent bg-secondary text-secondary-foreground'

  return (
    <Badge
      variant="outline"
      className={cn(statusClasses, className)}
    >
      {label}
    </Badge>
  )
}
