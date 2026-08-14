'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { SupabasePlatformStatusBanner } from '@/lib/supabase/platform-status'
import { cn } from '@/lib/utils'

type PortalNotificationsMenuProps = {
  supabasePlatformStatus?: SupabasePlatformStatusBanner | null
}

function severityDotClass (severity: SupabasePlatformStatusBanner['severity']) {
  if (severity === 'critical' || severity === 'major') return 'bg-destructive'
  if (severity === 'maintenance') return 'bg-blue-500'
  return 'bg-amber-500'
}

export function PortalNotificationsMenu ({
  supabasePlatformStatus,
}: PortalNotificationsMenuProps) {
  const items = supabasePlatformStatus ? [supabasePlatformStatus] : []
  const hasAlerts = items.length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={hasAlerts ? `Notificações, ${items.length} alerta(s)` : 'Notificações'}
        >
          <Bell className="h-4 w-4" />
          {hasAlerts ? (
            <span
              className={cn(
                'absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background',
                severityDotClass(items[0].severity),
              )}
              aria-hidden
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>
        </div>
        {hasAlerts ? (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((status) => (
              <li key={status.headline} className="border-b border-border/60 px-3 py-2.5 last:border-0">
                <p className="text-sm font-medium leading-snug">
                  Serviços Supabase: {status.headline}
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {status.detail
                    ? `Incidente em andamento: ${status.detail}`
                    : 'Parte da plataforma pode estar lenta ou indisponível.'}
                </p>
                <Link
                  href={status.statusPageHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Ver status oficial
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
