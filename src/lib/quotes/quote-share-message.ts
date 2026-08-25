import { formatDateBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'

export type BuildQuoteMessageOpts = {
  displayNumber: string | number
  title: string
  customerName: string
  status: string
  validUntil: string | null
  totalCents: number
  quoteHref: string
  organizationName?: string | null
  includeStatus?: boolean
}

function getFirstName (name: string): string {
  const first = String(name || '').trim().split(/\s+/)[0]
  return first || name || ''
}

export function buildQuoteMessage (opts: BuildQuoteMessageOpts): string {
  const firstName = getFirstName(opts.customerName)
  const org = String(opts.organizationName || '').trim()
  const titleSuffix = org ? ` - ${org}` : ''
  const lines = [
    `Olá${firstName ? ` ${firstName}` : ''}, segue o orçamento:`,
    '',
    `*Orçamento #${opts.displayNumber}*${titleSuffix}`,
  ]
  if (opts.title && opts.title.trim() && opts.title.trim() !== 'Orçamento') {
    lines.push(`Título: ${opts.title.trim()}`)
  }
  if (opts.includeStatus !== false) {
    lines.push(`Status: ${opts.status}`)
  }
  if (opts.validUntil) {
    const validade = formatDateBr(`${opts.validUntil}T12:00:00-03:00`)
    if (validade && validade !== '-') {
      lines.push(`Validade: ${validade}`)
    }
  }
  lines.push(`Total: ${formatCentsBr(opts.totalCents)}`)
  lines.push('', `Acesse o orçamento: ${opts.quoteHref}`)
  return lines.join('\n')
}

export function buildQuoteEmailSubject (
  displayNumber: string | number,
  organizationName?: string | null,
): string {
  const org = String(organizationName || '').trim()
  return org
    ? `Orçamento #${displayNumber} - ${org}`
    : `Orçamento #${displayNumber}`
}
