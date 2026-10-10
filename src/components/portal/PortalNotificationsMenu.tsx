'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { SupabasePlatformStatusBanner } from '@/lib/supabase/platform-status'
import { forgetStaffNotice, subscribeStaffNotices, type StaffNotice } from '@/lib/portal/staff-notices-poll'
import { enableStaffPush, readPushPermission, syncStaffPushSubscription } from '@/lib/portal/staff-push-client'
import { cn } from '@/lib/utils'

type PortalNotificationsMenuProps = {
  supabasePlatformStatus?: SupabasePlatformStatusBanner | null
  canReceiveStaffNotices?: boolean
}

function formatNoticeWhen (iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function severityDotClass (severity: SupabasePlatformStatusBanner['severity']) {
  if (severity === 'critical' || severity === 'major') return 'bg-destructive'
  if (severity === 'maintenance') return 'bg-blue-500'
  return 'bg-amber-500'
}

export function PortalNotificationsMenu ({
  supabasePlatformStatus,
  canReceiveStaffNotices = false,
}: PortalNotificationsMenuProps) {
  const items = supabasePlatformStatus ? [supabasePlatformStatus] : []
  const [staffNotices, setStaffNotices] = useState<StaffNotice[]>([])
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported' | 'failed'>('unsupported')
  const hasAlerts = items.length > 0 || staffNotices.length > 0
  const showPushPrompt = canReceiveStaffNotices && pushPermission !== 'granted' && pushPermission !== 'unsupported'

  useEffect(() => {
    if (!canReceiveStaffNotices) return
    const permission = readPushPermission()
    setPushPermission(permission)
    if (permission === 'granted') {
      void syncStaffPushSubscription().catch(() => {
        setPushPermission('failed')
      })
    }
    return subscribeStaffNotices((next) => {
      setStaffNotices(next)
    })
  }, [canReceiveStaffNotices])

  async function turnOnPush () {
    try {
      const result = await enableStaffPush()
      setPushPermission(result === 'failed' ? 'failed' : result)
    } catch {
      setPushPermission('failed')
    }
  }

  async function markStaffNoticeRead (id: string) {
    forgetStaffNotice(id)
    await fetch('/api/portal/staff-notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={staffNotices.length > 0
            ? `Notificações, ${staffNotices.length} não lida(s)`
            : hasAlerts
              ? 'Notificações, alerta da plataforma'
              : 'Notificações'}
        >
          <Bell className="h-4 w-4" />
          {staffNotices.length > 0 ? (
            <span
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              aria-hidden
            >
              {staffNotices.length > 9 ? '9+' : staffNotices.length}
            </span>
          ) : hasAlerts ? (
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
        {showPushPrompt ? (
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-medium">Avisos de agendamento</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {pushPermission === 'denied'
                ? 'O navegador bloqueou os avisos. Libere as notificações deste site para receber um alerta quando um cliente agendar.'
                : 'Receba um aviso neste navegador quando um cliente agendar.'}
            </p>
            {pushPermission === 'default' || pushPermission === 'failed' ? (
              <button
                type="button"
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={() => { void turnOnPush() }}
              >
                Ativar notificações
              </button>
            ) : null}
          </div>
        ) : null}
        {hasAlerts ? (
          <ul className="max-h-80 overflow-y-auto py-1">
            {staffNotices.map((notice) => {
              const when = notice.created_at ? formatNoticeWhen(notice.created_at) : ''
              return (
                <li key={notice.id} className="border-b border-border/60 px-3 py-2.5 last:border-0">
                  <p className="text-sm font-medium leading-snug">{notice.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{notice.body}</p>
                  {when ? <p className="mt-1 text-[11px] text-muted-foreground">{when}</p> : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {notice.href ? (
                      <Link
                        href={notice.href}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => { void markStaffNoticeRead(notice.id) }}
                      >
                        Abrir OS
                      </Link>
                    ) : <span />}
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => { void markStaffNoticeRead(notice.id) }}
                    >
                      Marcar como lida
                    </button>
                  </div>
                </li>
              )
            })}
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
        ) : showPushPrompt ? null : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
