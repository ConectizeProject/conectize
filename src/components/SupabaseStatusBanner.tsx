import Link from 'next/link'
import { AlertCircle, AlertTriangle, Wrench } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { SupabasePlatformStatusBanner } from '@/lib/supabase/platform-status'

type SupabaseStatusBannerProps = {
  status: SupabasePlatformStatusBanner
  className?: string
}

function severityStyles (severity: SupabasePlatformStatusBanner['severity']) {
  if (severity === 'critical' || severity === 'major') {
    return {
      wrap: 'border-destructive/60 bg-destructive/10 text-destructive dark:bg-destructive/20 [&>svg]:text-destructive',
      Icon: AlertCircle,
    }
  }
  if (severity === 'maintenance') {
    return {
      wrap: 'border-blue-500/50 bg-blue-500/10 text-blue-900 dark:text-blue-100 dark:bg-blue-500/15 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
      Icon: Wrench,
    }
  }
  return {
    wrap: 'border-amber-500/60 bg-amber-500/10 text-amber-950 dark:bg-amber-500/15 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-400',
    Icon: AlertTriangle,
  }
}

export function SupabaseStatusBanner ({ status, className }: SupabaseStatusBannerProps) {
  const { wrap, Icon } = severityStyles(status.severity)

  return (
    <Alert
      className={cn(
        'rounded-none border-x-0 border-t-0 shadow-none',
        wrap,
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <AlertTitle className="pr-6">Serviços Supabase: {status.headline}</AlertTitle>
      <AlertDescription className="space-y-2">
        {status.detail ? (
          <p>
            Incidente em andamento: <span className="font-medium">{status.detail}</span>
          </p>
        ) : (
          <p>
            Parte da plataforma pode estar lenta ou indisponível. Se algo falhar no portal, pode ser
            um problema temporário do provedor.
          </p>
        )}
        <p>
          <Link
            href={status.statusPageHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 hover:opacity-90"
          >
            Ver status oficial e atualizações
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  )
}
