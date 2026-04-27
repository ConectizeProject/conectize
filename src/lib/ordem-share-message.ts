/**
 * Monta a mensagem de compartilhamento da OS (WhatsApp/email).
 * Datas exibidas em horário de Brasília.
 */

import { formatDateTimeBr } from '@/lib/utils/format-date'

export type BuildOrderMessageOpts = {
  displayNumber: string | number
  title: string
  customerName: string
  device: string
  status: string
  estimatedReadyAt: string | null
  orderHref: string
  /** Nome da empresa (`organizations.name`) após o número da OS. Default true com sufixo só se houver nome. */
  titleSuffix?: boolean
  /** Nome da organização para o sufixo do título (ex.: compartilhamento WhatsApp). */
  organizationName?: string | null
  /** Incluir linha com status. Default true. */
  includeStatus?: boolean
}

function formatPrevisao(value: string | null): string {
  return formatDateTimeBr(value) === '-' ? '' : formatDateTimeBr(value)
}

function getFirstName(name: string): string {
  const first = String(name || '').trim().split(/\s+/)[0]
  return first || name || ''
}

/**
 * Gera o texto da mensagem para compartilhar OS (WhatsApp ou email).
 */
export function buildOrderMessage(opts: BuildOrderMessageOpts): string {
  const firstName = getFirstName(opts.customerName)
  const org = String(opts.organizationName || '').trim()
  const titleSuffix =
    opts.titleSuffix !== false && org ? ` - ${org}` : ''
  const lines = [
    `Olá${firstName ? ` ${firstName}` : ''}, segue abaixo os dados da sua ordem de serviço:`,
    '',
    `*Ordem de Serviço #${opts.displayNumber}*${titleSuffix}`,
    `Título: ${opts.title}`,
  ]
  if (opts.includeStatus !== false) {
    lines.push(`Status: ${opts.status}`)
  }
  lines.push(`Aparelho: ${opts.device || '-'}`)
  if (opts.estimatedReadyAt) {
    lines.push(`Previsão: ${formatPrevisao(opts.estimatedReadyAt)}`)
  }
  lines.push('', `Acesse sua OS: ${opts.orderHref}`)
  return lines.join('\n')
}

/** Assunto de e-mail da OS: inclui nome da empresa quando existir. */
export function buildOrderEmailSubject (
  displayNumber: string | number,
  organizationName?: string | null,
): string {
  const base = `Ordem de Serviço #${displayNumber}`
  const org = String(organizationName || '').trim()
  return org ? `${base} - ${org}` : base
}
