import { Badge } from '@/components/ui/badge'
import { QUOTE_STATUS_LABELS } from '@/lib/quotes/quote-status'
import { cn } from '@/lib/utils'

const STATUS_CLASSES: Record<string, string> = {
  rascunho: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
  enviado: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  aprovado: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  recusado: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  expirado: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  convertido: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300',
  cancelado: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
}

type Props = {
  status: string
  className?: string
}

export function QuoteStatusBadge ({ status, className }: Props) {
  const label = QUOTE_STATUS_LABELS[status] ?? status
  const statusClasses = STATUS_CLASSES[status] ?? 'border-transparent bg-secondary text-secondary-foreground'

  return (
    <Badge variant="outline" className={cn(statusClasses, className)}>
      {label}
    </Badge>
  )
}
