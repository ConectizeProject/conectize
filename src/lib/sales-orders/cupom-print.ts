import type { CompanyPrintData } from '@/lib/ordem-print'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
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
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

/**
 * Cupom de venda não-fiscal (comprovante interno) para impressão térmica / A4 estreito.
 */
export function buildSalesCupomHtml (
  cupom: SalesCupomData,
  company?: CompanyPrintData | null
): string {
  const companyName = escapeHtml(company?.name || 'Empresa')
  const companyCnpj = formatCompanyCnpj(company?.cnpj || null)
  const companyAddress = escapeHtml(buildCompanyAddress(company))
  const companyPhone = company?.phone ? formatPhoneBr(company.phone) : ''
  const companyEmail = company?.email ? escapeHtml(company.email) : ''

  const customerName = escapeHtml(cupom.customerName || 'Consumidor Final')
  const customerDoc = cupom.customerDocument
    ? formatCpfCnpj(cupom.customerDocument)
    : ''

  const itemsHtml = cupom.items.map((item) => {
    const name = escapeHtml(item.name || 'Produto')
    const sku = item.sku ? escapeHtml(String(item.sku)) : ''
    return `
      <tr>
        <td class="item-name">
          <div>${name}</div>
          ${sku ? `<div class="muted">SKU ${sku}</div>` : ''}
          <div class="muted">${item.quantity} × ${formatCentsBr(item.unitPriceCents)}${item.discountCents > 0 ? ` (−${formatCentsBr(item.discountCents)})` : ''}</div>
        </td>
        <td class="item-total">${formatCentsBr(item.subtotalCents)}</td>
      </tr>
    `
  }).join('')

  const paymentsHtml = cupom.payments.length > 0
    ? cupom.payments.map((p) => `
        <div class="row">
          <span>${escapeHtml(p.methodLabel)}</span>
          <span>${formatCentsBr(p.amountCents)}</span>
        </div>
      `).join('')
    : '<div class="row"><span>Pagamento</span><span>—</span></div>'

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
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 4px 0; }
    .item-total { text-align: right; white-space: nowrap; font-weight: 600; }
    .totals .row strong { font-size: 13px; }
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
    <h1>CUPOM DE VENDA</h1>
    <div class="muted">Documento não fiscal</div>
  </div>

  <div style="margin-top:8px">
    <div class="row"><span>Pedido</span><span><strong>#${escapeHtml(String(cupom.orderNumber))}</strong></span></div>
    <div class="row"><span>Data</span><span>${escapeHtml(formatDateTimeBr(cupom.createdAt))}</span></div>
    <div class="row"><span>Cliente</span><span>${customerName}</span></div>
    ${customerDoc ? `<div class="row"><span>Doc.</span><span>${escapeHtml(customerDoc)}</span></div>` : ''}
  </div>

  <hr class="sep" />

  <table>
    <tbody>
      ${itemsHtml || '<tr><td colspan="2" class="muted">Sem itens</td></tr>'}
    </tbody>
  </table>

  <hr class="sep" />

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatCentsBr(cupom.subtotalCents)}</span></div>
    ${cupom.discountTotalCents > 0 ? `<div class="row"><span>Desconto</span><span>−${formatCentsBr(cupom.discountTotalCents)}</span></div>` : ''}
    <div class="row"><span><strong>Total</strong></span><span><strong>${formatCentsBr(cupom.totalCents)}</strong></span></div>
  </div>

  <hr class="sep" />

  <div>
    <div style="margin-bottom:4px"><strong>Pagamentos</strong></div>
    ${paymentsHtml}
    <div class="row"><span>Pago</span><span>${formatCentsBr(cupom.paidAmountCents)}</span></div>
    ${cupom.changeCents > 0 ? `<div class="row"><span>Troco</span><span>${formatCentsBr(cupom.changeCents)}</span></div>` : ''}
  </div>

  <hr class="sep" />

  <footer class="footer center">
    <div>Obrigado pela preferência!</div>
    <div class="muted">Este cupom não substitui documento fiscal (NFC-e / NF-e).</div>
  </footer>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`
}
