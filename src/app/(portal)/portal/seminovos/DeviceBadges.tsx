'use client'

import { Copy } from 'lucide-react'
import { getSeminovosColorStyle } from '@/lib/seminovos/colors'
import { toast } from '@/hooks/use-toast'

type DeviceBadgesProps = {
  deviceName: string | null
  storageGb: string | null
  color: string | null
  battery: string | null
  condition: string | null
  imei?: string | null
}

export function DeviceBadges({ deviceName, storageGb, color, battery, condition, imei }: DeviceBadgesProps) {
  const nome = (deviceName || '').trim()
  const gb = storageGb ? `${storageGb}GB` : null
  const cor = (color || '').trim()
  const bat = battery || ''
  const est = (condition || '').trim()
  const colorStyle = cor ? getSeminovosColorStyle(cor) : null

  const estadoStyle = est
    ? est.startsWith('A')
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : est.startsWith('B')
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
    : ''

  return (
    <div className="min-w-0 space-y-1 leading-tight">
      <p className="font-medium truncate">
        {nome || '-'}
        {gb && (
          <>
            {' '}
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-foreground/10 text-foreground border border-border/60">
              {gb}
            </span>
          </>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
        {cor && colorStyle && (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: colorStyle.bg, color: colorStyle.text }}
          >
            {cor}
          </span>
        )}
        {bat && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-emerald-500">
            {bat}
          </span>
        )}
        {est && (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${estadoStyle}`}>
            {est}
          </span>
        )}
        {imei && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigator?.clipboard?.writeText(imei).then(() => toast({ description: 'Copiado', duration: 2000 })).catch(() => {})
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold bg-muted/70 hover:bg-muted border border-border/60"
          >
            <span className="truncate max-w-[100px]">{imei}</span>
            <Copy className="h-2.5 w-2.5 shrink-0" />
          </button>
        )}
      </p>
    </div>
  )
}

