import { formatDateBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import type { CompanyPrintData } from '@/lib/ordem-print'
import { getQuoteStatusLabel } from '@/lib/quotes/quote-status'

export type QuotePrintCustomer = {
  fullName: string
  companyName: string | null
  isCompany: boolean
  cpf: string | null
  cnpj: string | null
  email: string | null
  mobilePhone: string | null
  contactPhone: string | null
  contactNotes: string | null
  addressFull: string | null
}

export type QuotePrintItem = {
  description: string
  quantity: number
  valueCents: number
}

export type QuotePrintData = {
  displayNumber: number | string | null
  status: string
  title: string
  createdAt: string
  validUntil: string | null
  notes: string | null
  customer: QuotePrintCustomer
  items: QuotePrintItem[]
  totalCents: number
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

function buildCustomerSection (
  customer: QuotePrintCustomer,
  customerName: string,
): string {
  const items: string[] = []
  if (customerName && customerName !== '-') {
    items.push(`<span><strong>${escapeHtml(customerName)}</strong></span>`)
  }
  const doc = formatDoc(customer.isCompany ? customer.cnpj : customer.cpf, customer.isCompany)
  if (doc && doc !== '-') {
    items.push(`<span>${escapeHtml(doc)}</span>`)
  }
  if (customer.email?.trim()) {
    items.push(`<span>${escapeHtml(customer.email.trim())}</span>`)
  }
  const cel = customer.mobilePhone ? formatPhoneBr(customer.mobilePhone) : null
  if (cel) {
    items.push(`<span>${escapeHtml(cel)}</span>`)
  }
  const contactParts: string[] = []
  if (customer.contactPhone) {
    contactParts.push(formatPhoneBr(customer.contactPhone) || customer.contactPhone)
  }
  if (customer.contactNotes?.trim()) {
    contactParts.push(customer.contactNotes.trim())
  }
  if (contactParts.length > 0) {
    items.push(`<span>${escapeHtml(contactParts.join(' — '))}</span>`)
  }
  if (customer.addressFull?.trim()) {
    items.push(`<span>${escapeHtml(customer.addressFull.trim())}</span>`)
  }
  if (items.length === 0) return ''
  return `<div class="section" style="margin-bottom: 12px;">
    <h2 style="margin-bottom: 6px;">Cliente</h2>
    <div style="font-size: 11px; line-height: 1.5; color: #333;">${items.join(' • ')}</div>
  </div>`
}

function buildItemsSection (items: QuotePrintItem[], totalCents: number): string {
  if (!items.length) {
    return `<div class="section"><h2>Itens</h2><p>Nenhum item.</p></div>`
  }
  const rows = items
    .map((s) => {
      const desc = (s.description || '-').trim() || '-'
      const qty = s.quantity > 1 ? ` × ${s.quantity}` : ''
      return `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px;">${escapeHtml(desc)}${qty}</td>
            <td style="text-align: right; padding: 6px 8px;">${formatCentsBr(s.valueCents)}</td>
          </tr>`
    })
    .join('')
  return `
  <div class="section">
    <h2>Itens</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="border-bottom: 1px solid #ddd;">
          <th style="text-align: left; padding: 6px 8px; color: #666;">Descrição</th>
          <th style="text-align: right; padding: 6px 8px; color: #666;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p style="margin-top: 8px; text-align: right; font-weight: 600;">
      Total: ${formatCentsBr(totalCents)}
    </p>
  </div>
  `
}

export function buildOrcamentoPrintHtml (
  data: QuotePrintData,
  company?: CompanyPrintData | null,
  baseUrl: string = '',
  options?: { autoPrint?: boolean; includeStatus?: boolean },
): string {
  const autoPrint = options?.autoPrint !== false
  const includeStatus = options?.includeStatus === true
  const logoFullUrl = company?.logoUrl
    ? company.logoUrl.startsWith('http')
      ? company.logoUrl
      : company.logoUrl.startsWith('/')
        ? company.logoUrl
        : `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}${company.logoUrl}`
    : ''
  const customerName = data.customer.isCompany
    ? (data.customer.companyName || data.customer.fullName || '-')
    : (data.customer.fullName || '-')
  const validade = data.validUntil
    ? formatDateBr(`${data.validUntil}T12:00:00-03:00`)
    : '-'
  const statusPart = includeStatus
    ? ` | <strong>Status:</strong> ${escapeHtml(getQuoteStatusLabel(data.status))}`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento #${data.displayNumber ?? ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4; color: #111; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 8px; padding-bottom: 8px; }
    h2 { font-size: 13px; margin: 16px 0 6px; color: #555; }
    .section { margin-bottom: 16px; }
    .block { margin-top: 8px; white-space: pre-wrap; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
    .print-header{ display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #ccc;}
    .print-header img { max-height: 56px; object-fit: contain; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { .print-header img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${company && (company.name || company.logoUrl || company.address || company.cnpj) ? `
  <div class="print-header">
    ${logoFullUrl ? `<img src="${escapeHtml(logoFullUrl)}" alt="Logo" style="height: 48px; width: auto;" onerror="this.style.display='none'" />` : ''}
    <div style="flex: 1;">
      ${company.name ? `<div style="font-size: 16px; font-weight: 700;">${escapeHtml(company.name)}</div>` : ''}
      ${company.cnpj ? `<div style="font-size: 11px; color: #555;">CNPJ ${escapeHtml(formatCompanyCnpj(company.cnpj))}</div>` : ''}
      ${buildCompanyAddress(company) ? `<div style="font-size: 11px; color: #555;">${escapeHtml(buildCompanyAddress(company))}</div>` : ''}
      ${company.phone || company.email ? `<div style="font-size: 11px; color: #555;">${escapeHtml([company.phone, company.email].filter(Boolean).join(' • '))}</div>` : ''}
    </div>
  </div>
  ` : ''}
  <h1>Orçamento #${escapeHtml(String(data.displayNumber ?? ''))}${data.title ? ` — ${escapeHtml(data.title)}` : ''}</h1>
  <p><strong>Data:</strong> ${escapeHtml(formatDateBr(data.createdAt))} | <strong>Validade:</strong> ${escapeHtml(validade)}${statusPart}</p>

  ${buildCustomerSection(data.customer, customerName)}
  ${buildItemsSection(data.items, data.totalCents)}
  ${data.notes?.trim() ? `<div class="section"><h2>Observações</h2><div class="block">${escapeHtml(data.notes.trim())}</div></div>` : ''}
  <div class="footer">Este orçamento é válido até ${escapeHtml(validade)}.</div>
  ${autoPrint ? `<script>
    window.onload = function () {
      var imgs = document.querySelectorAll('img')
      var pending = imgs.length
      function go () { window.print() }
      if (!pending) { go(); return }
      imgs.forEach(function (img) {
        if (img.complete) { pending--; if (!pending) go() }
        else {
          img.addEventListener('load', function () { pending--; if (!pending) go() })
          img.addEventListener('error', function () { pending--; if (!pending) go() })
        }
      })
    }
  </script>` : ''}
</body>
</html>
`
}
