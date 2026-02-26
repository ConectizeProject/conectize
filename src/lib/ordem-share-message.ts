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
  /** Incluir " - Conectize" no título da OS. Default true. */
  titleSuffix?: boolean
  /** Incluir linha com status. Default true. */
  includeStatus?: boolean
}

function formatPrevisao(value: string | null): string {
  return formatDateTimeBr(value) === '-' ? '' : formatDateTimeBr(value)
}

/**
 * Gera o texto da mensagem para compartilhar OS (WhatsApp ou email).
 */
export function buildOrderMessage(opts: BuildOrderMessageOpts): string {
  const titleSuffix = opts.titleSuffix !== false ? ' - Conectize' : ''
  const lines = [
    `Olá${opts.customerName ? ` ${opts.customerName}` : ''}!`,
    '',
    `*Ordem de Serviço #${opts.displayNumber}*${titleSuffix}`,
    `Título: ${opts.title}`,
  ]
  if (opts.includeStatus !== false) {
    lines.push(`Status: ${opts.status}`)
  }
  lines.push(`Dispositivo: ${opts.device || '-'}`)
  if (opts.estimatedReadyAt) {
    lines.push(`Previsão: ${formatPrevisao(opts.estimatedReadyAt)}`)
  }
  lines.push('', `Acesse sua OS: ${opts.orderHref}`)
  return lines.join('\n')
}
