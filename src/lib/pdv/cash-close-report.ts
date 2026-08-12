import type { CompanyPrintData } from '@/lib/ordem-print'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_TYPES,
  type CashCloseSummary,
  type PaymentMethodType,
} from '@/lib/pdv/cash-close-summary'

export type CashCloseReportMeta = {
  openedAt?: string | null
  closedAt?: string | null
  sellerName?: string | null
  countedCashCents?: number | null
  countedByMethod?: Partial<Record<PaymentMethodType, number>> | null
}

function escapeHtml (text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

function formatCentsBr (cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDiffCents (diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  return `${sign}${formatCentsBr(Math.abs(diff))}`
}

function formatCompanyCnpj (value: string | null): string {
  if (!value) return ''
  const d = value.replace(/\D/g, '')
  if (d.length >= 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  return value
}

function buildCompanyAddress (c: CompanyPrintData | null | undefined): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.address) parts.push(c.address)
  if (c.complement) parts.push(c.complement)
  if (c.city || c.state) parts.push([c.city, c.state].filter(Boolean).join(' - '))
  if (c.zipCode) parts.push(`CEP ${c.zipCode}`)
  return parts.join(', ')
}

function row (label: string, value: string, opts?: { strong?: boolean, muted?: boolean }) {
  const labelHtml = opts?.strong ? `<strong>${escapeHtml(label)}</strong>` : escapeHtml(label)
  const valueHtml = opts?.strong ? `<strong>${escapeHtml(value)}</strong>` : escapeHtml(value)
  const className = opts?.muted ? 'row muted' : 'row'
  return `<div class="${className}"><span>${labelHtml}</span><span>${valueHtml}</span></div>`
}

/**
 * Relatório de fechamento de caixa (comprovante interno) para impressão térmica / A4 estreito.
 */
export function buildCashCloseReportHtml (
  summary: CashCloseSummary,
  meta: CashCloseReportMeta = {},
  company?: CompanyPrintData | null,
): string {
  const companyName = escapeHtml(company?.name || 'Empresa')
  const companyCnpj = formatCompanyCnpj(company?.cnpj || null)
  const companyAddress = escapeHtml(buildCompanyAddress(company))
  const companyPhone = company?.phone ? formatPhoneBr(company.phone) : ''
  const companyEmail = company?.email ? escapeHtml(company.email) : ''

  const openedAt = meta.openedAt ? formatDateTimeBr(meta.openedAt) : '—'
  const closedAt = meta.closedAt ? formatDateTimeBr(meta.closedAt) : formatDateTimeBr(new Date().toISOString())
  const sellerName = escapeHtml(meta.sellerName || '—')

  const methodRows = summary.methods_used.length > 0
    ? summary.methods_used.map((type) =>
      row(PAYMENT_METHOD_LABELS[type], formatCentsBr(summary.by_method[type])),
    ).join('')
    : '<div class="muted">Nenhuma venda finalizada nesta sessão</div>'

  const countedCash = meta.countedCashCents
  const hasCashConference = countedCash != null && Number.isFinite(countedCash)
  const cashDiff = hasCashConference
    ? Number(countedCash) - summary.expected_cash_cents
    : null

  const countedByMethod = meta.countedByMethod || {}
  const conferenceMethodRows = PAYMENT_METHOD_TYPES
    .filter((type) => type !== 'dinheiro' && countedByMethod[type] != null)
    .map((type) => {
      const counted = Number(countedByMethod[type]) || 0
      const system = summary.by_method[type]
      const diff = counted - system
      return `
        ${row(PAYMENT_METHOD_LABELS[type] + ' (sistema)', formatCentsBr(system))}
        ${row(PAYMENT_METHOD_LABELS[type] + ' (conferido)', formatCentsBr(counted))}
        ${row('Diferença ' + PAYMENT_METHOD_LABELS[type], formatDiffCents(diff), { muted: true })}
      `
    }).join('')

  const hasConference = hasCashConference || conferenceMethodRows.length > 0

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fechamento de caixa</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color: #111;
      background: #fff;
      font-size: 12px;
      line-height: 1.35;
      padding: 8px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .muted { color: #444; font-size: 10px; }
    .sep { border: none; border-top: 1px dashed #222; margin: 8px 0; }
    h1 { font-size: 14px; font-weight: 700; }
    .company-name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    .section-title { font-weight: 700; margin: 4px 0 2px; font-size: 11px; text-transform: uppercase; }
    .footer { margin-top: 10px; font-size: 10px; }
    @media print {
      body { padding: 0; max-width: none; width: 80mm; }
      @page { margin: 4mm; size: auto; }
    }
  </style>
</head>
<body>
  <header class="center">
    <div class="company-name">${companyName}</div>
    ${companyCnpj ? `<div>CNPJ ${escapeHtml(companyCnpj)}</div>` : ''}
    ${companyAddress ? `<div class="muted">${companyAddress}</div>` : ''}
    ${companyPhone ? `<div class="muted">${escapeHtml(companyPhone)}</div>` : ''}
    ${companyEmail ? `<div class="muted">${companyEmail}</div>` : ''}
  </header>

  <hr class="sep" />

  <div class="center">
    <h1>FECHAMENTO DE CAIXA</h1>
    <div class="muted">Documento interno · não fiscal</div>
  </div>

  <div style="margin-top:8px">
    ${row('Abertura', openedAt)}
    ${row('Emissão', closedAt)}
    ${row('Operador', sellerName)}
    ${row('Vendas', String(summary.paid_orders_count))}
  </div>

  <hr class="sep" />

  <div class="section-title">Movimentação</div>
  ${row('Caixa aberto com', formatCentsBr(summary.opening_amount_cents))}
  ${row('Sangrias', '−' + formatCentsBr(summary.sangrias_cents))}
  ${summary.suprimentos_cents > 0 ? row('Suprimentos', '+' + formatCentsBr(summary.suprimentos_cents)) : ''}
  ${summary.total_change_cents > 0 ? row('Troco concedido', '−' + formatCentsBr(summary.total_change_cents)) : ''}
  ${row('Dinheiro das vendas', formatCentsBr(summary.cash_from_orders_cents))}
  ${row('Dinheiro esperado', formatCentsBr(summary.expected_cash_cents), { strong: true })}

  <hr class="sep" />

  <div class="section-title">Recebido por forma</div>
  ${methodRows}

  ${hasConference ? `
  <hr class="sep" />
  <div class="section-title">Conferência</div>
  ${hasCashConference ? `
    ${row('Dinheiro esperado', formatCentsBr(summary.expected_cash_cents))}
    ${row('Dinheiro conferido', formatCentsBr(Number(countedCash)))}
    ${cashDiff != null ? row('Diferença caixa', formatDiffCents(cashDiff), { strong: true }) : ''}
  ` : ''}
  ${conferenceMethodRows}
  ` : ''}

  <hr class="sep" />

  <footer class="footer center">
    <div>Conferência de caixa · uso interno</div>
    <div class="muted">Sessão ${escapeHtml(summary.session_id.slice(0, 8))}…</div>
  </footer>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`
}
