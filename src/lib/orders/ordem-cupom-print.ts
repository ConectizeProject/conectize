import type { CompanyPrintData, OrdemPrintData } from '@/lib/ordem-print'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'

export type BuildOrdemCupomHtmlOptions = {
  autoPrint?: boolean
  baseUrl?: string
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
 * Cupom da OS para impressora térmica (80mm).
 * Foco em identificação da ordem + comprovante de valores já pagos.
 */
export function buildOrdemCupomHtml (
  data: OrdemPrintData,
  company?: CompanyPrintData | null,
  options?: BuildOrdemCupomHtmlOptions,
): string {
  const shouldAutoPrint = options?.autoPrint !== false
  const osNumber = String(data.displayNumber ?? '').trim() || '—'
  const companyName = escapeHtml(company?.name || '')
  const companyCnpj = formatCompanyCnpj(company?.cnpj || null)
  const companyAddress = escapeHtml(buildCompanyAddress(company))
  const companyPhone = company?.phone ? formatPhoneBr(company.phone) : ''
  const logoFullUrl = company?.logoUrl
    ? company.logoUrl.startsWith('http') || company.logoUrl.startsWith('/')
      ? company.logoUrl
      : `${options?.baseUrl || ''}${(options?.baseUrl || '').endsWith('/') ? '' : '/'}${company.logoUrl}`
    : ''
  const customerName = data.customer.isCompany
    ? (data.customer.companyName || data.customer.fullName || '-')
    : (data.customer.fullName || '-')
  const title = escapeHtml((data.title || '-').trim() || '-')
  const device = escapeHtml((data.device || '-').trim() || '-')
  const entrada = escapeHtml(formatDateTimeBr(data.createdAt))
  const previsao = data.estimatedReadyAt
    ? escapeHtml(formatDateTimeBr(data.estimatedReadyAt))
    : ''

  const payments = (data.payments || [])
    .filter((p) => Math.max(0, Number(p.amountCents) || 0) > 0)
    .map((p) => ({
      label: escapeHtml(String(p.label || 'Pagamento').trim() || 'Pagamento'),
      amountCents: Math.max(0, Number(p.amountCents) || 0),
    }))
  const paidTotalCents = payments.reduce((acc, p) => acc + p.amountCents, 0)
  const paymentsHtml = payments.length > 0
    ? payments.map((p) => `
      <tr>
        <td class="col-item">${p.label}</td>
        <td class="col-total">${formatCentsBr(p.amountCents)}</td>
      </tr>`).join('')
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cupom OS ${escapeHtml(osNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      background: #fff;
      font-size: 13px;
      line-height: 1.4;
      padding: 8px;
      max-width: 80mm;
      margin: 0 auto;
      -webkit-font-smoothing: none;
    }
    .center { text-align: center; }
    .sep { border: none; border-top: 1px dashed #000; margin: 10px 0; }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 2px;
    }
    .logo-wrap {
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      background: #000;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
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
    .company-name { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
    .header-info div { font-size: 11px; line-height: 1.35; word-break: break-word; }
    .doc-label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 4px;
    }
    .os-number {
      font-size: 42px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.02em;
      margin: 4px 0 6px;
      color: #000;
    }
    .os-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 2px;
      word-break: break-word;
    }
    .kv {
      margin: 5px 0;
      font-size: 13px;
      color: #000;
    }
    .kv .k {
      font-weight: 700;
      color: #000;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
      color: #000;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; padding: 4px 2px; font-size: 13px; color: #000; }
    thead th {
      font-size: 11px;
      font-weight: 800;
      text-align: left;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      text-transform: uppercase;
    }
    .col-item { width: 65%; word-break: break-word; }
    .col-total { width: 35%; text-align: right; white-space: nowrap; font-weight: 700; }
    th.col-total { text-align: right; }
    .totals { margin-top: 6px; }
    .totals .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 3px 0;
      font-size: 14px;
      font-weight: 800;
      color: #000;
    }
    .footer {
      margin-top: 12px;
      font-size: 12px;
      line-height: 1.45;
      text-align: center;
      color: #000;
      font-weight: 600;
    }
    .footer .note {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 700;
      text-align: left;
    }
    .footer .printed {
      margin-top: 8px;
      font-size: 11px;
      font-weight: 600;
    }
    @media print {
      body { padding: 0; max-width: none; width: 80mm; }
      @page { margin: 4mm; size: auto; }
      .logo-wrap, .logo-wrap img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${company && (company.name || company.logoUrl || company.address || company.cnpj) ? `
  <header class="header">
    ${logoFullUrl
      ? `<div class="logo-wrap"><img src="${escapeHtml(logoFullUrl)}" alt="" onerror="this.parentElement.style.display='none'" /></div>`
      : ''}
    <div class="header-info">
      ${companyName ? `<div class="company-name">${companyName}</div>` : ''}
      ${companyCnpj ? `<div>${escapeHtml(companyCnpj)}</div>` : ''}
      ${companyAddress ? `<div>${companyAddress}</div>` : ''}
      ${companyPhone ? `<div>${escapeHtml(companyPhone)}</div>` : ''}
    </div>
  </header>
  <hr class="sep" />
  ` : ''}

  <div class="center">
    <div class="doc-label">Ordem de serviço</div>
    <div class="os-number">${escapeHtml(osNumber)}</div>
    <div class="os-title">${title}</div>
  </div>

  <hr class="sep" />

  <div class="kv"><span class="k">Entrada:</span> ${entrada}</div>
  ${previsao ? `<div class="kv"><span class="k">Previsão:</span> ${previsao}</div>` : ''}
  <div class="kv"><span class="k">Cliente:</span> ${escapeHtml(customerName)}</div>
  <div class="kv"><span class="k">Aparelho:</span> ${device}</div>

  ${paymentsHtml ? `
  <hr class="sep" />
  <div class="section-title">Recibo de valores pagos</div>
  <table>
    <thead>
      <tr>
        <th class="col-item">Forma</th>
        <th class="col-total">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${paymentsHtml}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Total pago</span><span>${formatCentsBr(paidTotalCents)}</span></div>
  </div>
  ` : ''}

  <hr class="sep" />
  <div class="footer">
    Guarde este comprovante.
    <div class="note">
      Para outra pessoa retirar o aparelho, avise previamente a assistência e informe os dados de quem irá retirar.
    </div>
    <div class="printed">Impresso em ${escapeHtml(formatDateTimeBr(new Date()))}</div>
  </div>

  ${shouldAutoPrint ? `<script>
    window.onload = function () {
      var img = document.querySelector('.logo-wrap img');
      var done = false;
      function doPrint() { if (!done) { done = true; window.print(); } }
      if (img) {
        img.onload = img.onerror = function () { setTimeout(doPrint, 50); };
        if (img.complete) setTimeout(doPrint, 100);
        setTimeout(doPrint, 2500);
      } else {
        setTimeout(doPrint, 100);
      }
    };
  </script>` : ''}
</body>
</html>
`
}
