import type { CompanyPrintData, OrdemPrintData } from '@/lib/ordem-print'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
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

function formatDoc (value: string | null, isCompany: boolean): string {
  if (!value) return '-'
  const digits = value.replace(/\D/g, '')
  if (isCompany && digits.length >= 14) {
    const m = digits.match(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/)
    return m ? `CNPJ ${m[1]}.${m[2]}.${m[3]}/${m[4]}-${m[5]}` : `CNPJ ${value}`
  }
  if (digits.length >= 11) {
    const m = digits.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/)
    return m ? `CPF ${m[1]}.${m[2]}.${m[3]}-${m[4]}` : `CPF ${value}`
  }
  return isCompany ? `CNPJ ${value}` : `CPF ${value}`
}

/**
 * Cupom da OS para impressora térmica (80mm), no mesmo espírito do cupom do PDV.
 * Número da OS em destaque.
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
  const customerDoc = formatDoc(
    data.customer.isCompany ? data.customer.cnpj : data.customer.cpf,
    data.customer.isCompany,
  )
  const customerPhone = data.customer.mobilePhone
    ? formatPhoneBr(data.customer.mobilePhone)
    : null
  const statusLabel = escapeHtml(getOrderStatusLabel(data.status))
  const title = escapeHtml((data.title || '-').trim() || '-')
  const device = escapeHtml((data.device || '-').trim() || '-')
  const imei = data.imei ? escapeHtml(String(data.imei)) : ''
  const entrada = escapeHtml(formatDateTimeBr(data.createdAt))
  const previsao = data.estimatedReadyAt
    ? escapeHtml(formatDateTimeBr(data.estimatedReadyAt))
    : ''
  const description = data.customerDescription?.trim()
    ? escapeHtml(data.customerDescription.trim())
    : ''

  const services = data.services || []
  const servicesHtml = services.length > 0
    ? services.map((s) => {
      const desc = escapeHtml((s.description ?? '').toString().trim() || '-')
      const valueCents = Math.max(0, Number(s.valueCents) || 0)
      return `
      <tr>
        <td class="col-item">${desc}</td>
        <td class="col-total">${formatCentsBr(valueCents)}</td>
      </tr>`
    }).join('')
    : ''
  const totalCents = services.reduce(
    (acc, s) => acc + Math.max(0, Number(s.valueCents) || 0),
    0,
  )

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cupom OS #${escapeHtml(osNumber)}</title>
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
    .os-number {
      font-size: 28px;
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -0.03em;
      margin: 6px 0 2px;
    }
    .os-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; word-break: break-word; }
    .kv { margin: 2px 0; }
    .kv .k { color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; padding: 3px 2px; }
    thead th {
      font-size: 9px;
      font-weight: 700;
      text-align: left;
      border-bottom: 1px solid #222;
      padding-bottom: 4px;
    }
    .col-item { width: 70%; word-break: break-word; }
    .col-total { width: 30%; text-align: right; white-space: nowrap; }
    th.col-total { text-align: right; }
    .totals { margin-top: 4px; }
    .totals .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .totals .row.total { font-size: 13px; font-weight: 700; margin-top: 4px; }
    .block { white-space: pre-wrap; word-break: break-word; margin-top: 2px; }
    .footer { margin-top: 10px; font-size: 10px; text-align: center; color: #555; }
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
    <div class="muted">ORDEM DE SERVIÇO</div>
    <div class="os-number">#${escapeHtml(osNumber)}</div>
    <div class="os-title">${title}</div>
  </div>

  <hr class="sep" />

  <div class="kv"><span class="k">Status:</span> ${statusLabel}</div>
  <div class="kv"><span class="k">Entrada:</span> ${entrada}</div>
  ${previsao ? `<div class="kv"><span class="k">Previsão:</span> ${previsao}</div>` : ''}

  <hr class="sep" />

  <div class="kv"><span class="k">Cliente:</span> ${escapeHtml(customerName)}</div>
  ${customerDoc && customerDoc !== '-' ? `<div class="kv muted">${escapeHtml(customerDoc)}</div>` : ''}
  ${customerPhone ? `<div class="kv muted">${escapeHtml(customerPhone)}</div>` : ''}

  <hr class="sep" />

  <div class="kv"><span class="k">Aparelho:</span> ${device}</div>
  ${imei ? `<div class="kv muted">IMEI: ${imei}</div>` : ''}

  ${description ? `
  <hr class="sep" />
  <div class="kv"><span class="k">Descrição</span></div>
  <div class="block">${description}</div>
  ` : ''}

  ${servicesHtml ? `
  <hr class="sep" />
  <table>
    <thead>
      <tr>
        <th class="col-item">Serviço / produto</th>
        <th class="col-total">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${servicesHtml}
    </tbody>
  </table>
  <div class="totals">
    <div class="row total"><span>Total</span><span>${formatCentsBr(totalCents)}</span></div>
  </div>
  ` : ''}

  <hr class="sep" />
  <div class="footer">
    Guarde este comprovante.<br />
    Impresso em ${escapeHtml(formatDateTimeBr(new Date()))}
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
