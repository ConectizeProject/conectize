import type { CompanyPrintData } from '@/lib/ordem-print'
import { formatDateBr, formatDateTimeBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'

export type SalesCupomItem = {
  name: string
  sku?: string | null
  quantity: number
  unitPriceCents: number
  discountCents: number
  subtotalCents: number
}

export type SalesCupomPayment = {
  methodLabel: string
  amountCents: number
}

export type SalesCupomData = {
  orderNumber: number | string
  createdAt: string
  customerName: string | null
  customerDocument: string | null
  subtotalCents: number
  discountTotalCents: number
  surchargeCents: number
  totalCents: number
  paidAmountCents: number
  changeCents: number
  items: SalesCupomItem[]
  payments: SalesCupomPayment[]
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
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

function resolveLogoUrl (logoUrl: string | null | undefined, baseUrl = ''): string {
  if (!logoUrl) return ''
  if (logoUrl.startsWith('http') || logoUrl.startsWith('/')) return logoUrl
  return `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}${logoUrl}`
}

/**
 * Cupom de venda não-fiscal (comprovante interno) para impressão térmica / A4 estreito.
 * `autoPrint: false` para preview em modal (impressão via iframe.contentWindow.print).
 */
export function buildSalesCupomHtml (
  cupom: SalesCupomData,
  company?: CompanyPrintData | null,
  options?: { autoPrint?: boolean, baseUrl?: string }
): string {
  const shouldAutoPrint = options?.autoPrint !== false
  const companyName = escapeHtml(company?.name || 'Empresa')
  const companyCnpj = formatCompanyCnpj(company?.cnpj || null)
  const companyAddress = escapeHtml(buildCompanyAddress(company))
  const companyPhone = company?.phone ? formatPhoneBr(company.phone) : ''
  const logoFullUrl = resolveLogoUrl(company?.logoUrl, options?.baseUrl || '')
  const dateLabel = escapeHtml(formatDateBr(cupom.createdAt))
  const dateTimeLabel = escapeHtml(formatDateTimeBr(cupom.createdAt))

  const itemsHtml = cupom.items.map((item) => {
    const name = escapeHtml(item.name || 'Produto')
    return `
      <tr>
        <td class="col-item">${name}</td>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-val">${formatCentsBr(item.unitPriceCents)}</td>
        <td class="col-total">${formatCentsBr(item.subtotalCents)}</td>
      </tr>
    `
  }).join('')

  const paymentsHtml = cupom.payments.length > 0
    ? cupom.payments.map((p) => `
        <tr>
          <td class="col-date">${dateLabel}</td>
          <td class="col-pay">${escapeHtml(p.methodLabel)}</td>
          <td class="col-pay-val">${formatCentsBr(p.amountCents)}</td>
        </tr>
      `).join('')
    : `<tr>
        <td class="col-date">${dateLabel}</td>
        <td class="col-pay">—</td>
        <td class="col-pay-val">${formatCentsBr(cupom.paidAmountCents || cupom.totalCents)}</td>
      </tr>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cupom Pedido #${escapeHtml(String(cupom.orderNumber))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color: #111;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      padding: 8px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .muted { color: #444; font-size: 10px; }
    .sep { border: none; border-top: 1px dashed #222; margin: 8px 0; }
    .spacer { height: 10px; }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 2px;
    }
    .logo-wrap {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      background: #000;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .logo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-info { flex: 1; min-width: 0; }
    .company-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .header-info div { font-size: 10px; line-height: 1.3; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; padding: 3px 2px; }
    thead th {
      font-size: 9px;
      font-weight: 700;
      text-align: left;
      border-bottom: 1px solid #222;
      padding-bottom: 4px;
    }
    .col-item { width: 48%; word-break: break-word; }
    .col-qty { width: 10%; text-align: center; white-space: nowrap; }
    .col-val, .col-total, .col-pay-val { text-align: right; white-space: nowrap; }
    .col-val { width: 20%; }
    .col-total { width: 22%; }
    .col-date { width: 34%; white-space: nowrap; font-size: 9px; }
    .col-pay { width: 36%; word-break: break-word; }
    .col-pay-val { width: 30%; }
    th.col-qty, th.col-val, th.col-total, th.col-pay-val { text-align: right; }
    th.col-qty { text-align: center; }
    .totals { margin: 2px 0; }
    .totals .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .totals .row.total { font-size: 12px; font-weight: 700; margin-top: 4px; }
    .footer { margin-top: 10px; font-size: 11px; }
    .footer .datetime { margin-top: 4px; font-size: 10px; }
    @media print {
      body { padding: 0; max-width: none; width: 80mm; }
      @page { margin: 4mm; size: auto; }
      .logo-wrap, .logo-wrap img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header class="header">
    ${logoFullUrl
      ? `<div class="logo-wrap"><img src="${escapeHtml(logoFullUrl)}" alt="" onerror="this.parentElement.style.display='none'" /></div>`
      : ''}
    <div class="header-info">
      <div class="company-name">${companyName}</div>
      ${companyCnpj ? `<div>${escapeHtml(companyCnpj)}</div>` : ''}
      ${companyPhone ? `<div>${escapeHtml(companyPhone)}</div>` : ''}
      ${companyAddress ? `<div>${companyAddress}</div>` : ''}
    </div>
  </header>

  <hr class="sep" />

  <table>
    <thead>
      <tr>
        <th class="col-item">Item</th>
        <th class="col-qty">Qtd</th>
        <th class="col-val">Valor</th>
        <th class="col-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml || '<tr><td colspan="4" class="muted">Sem itens</td></tr>'}
    </tbody>
    </table>

  <div class="spacer"></div>

  <table>
    <thead>
      <tr>
        <th class="col-date">Data</th>
        <th class="col-pay">Forma de pgto.</th>
        <th class="col-pay-val">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${paymentsHtml}
    </tbody>
  </table>

  <div class="spacer"></div>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatCentsBr(cupom.subtotalCents)}</span></div>
    ${cupom.discountTotalCents > 0
      ? `<div class="row"><span>Descontos</span><span>−${formatCentsBr(cupom.discountTotalCents)}</span></div>`
      : ''}
    ${cupom.surchargeCents > 0
      ? `<div class="row"><span>Adicional</span><span>${formatCentsBr(cupom.surchargeCents)}</span></div>`
      : ''}
    <div class="row total"><span>Total</span><span>${formatCentsBr(cupom.totalCents)}</span></div>
  </div>

  <hr class="sep" />

  <footer class="footer center">
    <div>Obrigado pela preferência!</div>
    <div class="datetime">${dateTimeLabel}</div>
  </footer>

  ${shouldAutoPrint
    ? `<script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>`
    : ''}
</body>
</html>`
}
