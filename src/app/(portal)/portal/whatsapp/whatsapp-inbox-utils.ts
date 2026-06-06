import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatWaMessageTime (iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isToday(d)) return format(d, 'HH:mm', { locale: ptBR })
  if (isYesterday(d)) return `Ontem ${format(d, 'HH:mm', { locale: ptBR })}`
  return format(d, 'dd/MM/yy HH:mm', { locale: ptBR })
}

export function formatWaDayDivider (iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function waDayKey (iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'yyyy-MM-dd')
}

export function waAvatarHue (seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h + seed.charCodeAt(i) * 17) % 360
  }
  return h
}

export function waInitials (label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

/** Copia e cola PIX (EMV) ou texto longo sem espaços — precisa quebrar em qualquer caractere. */
export function isLikelyMonospacePixText (text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.includes('000201') && t.includes('6304')) return true
  if (t.length >= 72 && !/\s/.test(t)) return true
  return false
}

export function waMessageBodyClassName (body: string | null | undefined): string {
  const base = 'whitespace-pre-wrap text-sm max-w-full'
  if (body && isLikelyMonospacePixText(body)) {
    return `${base} break-all [overflow-wrap:anywhere] font-mono text-[13px] leading-snug`
  }
  return `${base} break-words`
}
