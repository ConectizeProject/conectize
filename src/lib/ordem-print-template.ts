/**
 * Modelo único de impressão para Ordem de Serviço.
 * Usado pelo OrdemPrintButton (cliente) e pela API /api/portal/ordens/[id]/print (servidor).
 */

export type CompanyPrintData = {
  name: string | null
  cnpj: string | null
  address: string | null
  complement: string | null
  zipCode: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

export type OrdemPrintData = {
  displayNumber: number | string | null
  status: string
  title: string
  createdAt: string
  updatedAt: string
  customer: {
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
  device: string
  imei: string | null
  isWarranty: boolean
  estimatedReadyAt: string | null
  customerDescription: string | null
  internalDescription: string | null
  receivingNotes: string | null
  assistanceInfo?: string | null
  services?: Array<{
    description?: string | null
    valueCents?: number | null
    costCents?: number | null
  }> | null
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    orcamento: 'Orçamento',
    aprovado: 'Aprovado',
    aguardando_pecas: 'Aguardando peças',
    em_manutencao: 'Em manutenção',
    aguardando_retirada: 'Aguardando retirada',
    finalizada: 'Finalizada',
    finalizada_sem_conserto: 'Finalizada sem conserto',
    finalizada_sem_aprovacao: 'Finalizada sem aprovação',
    cancelada: 'Cancelada',
  }
  return map[status] || status
}

function formatDoc(value: string | null, isCompany: boolean): string {
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

function formatDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCentsBr(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatCompanyCnpj(value: string | null): string {
  if (!value) return ''
  const d = value.replace(/\D/g, '')
  if (d.length >= 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  return value
}

function buildCompanyAddress(c: CompanyPrintData | null | undefined): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.address) parts.push(c.address)
  if (c.complement) parts.push(c.complement)
  if (c.city || c.state) parts.push([c.city, c.state].filter(Boolean).join(' - '))
  if (c.zipCode) parts.push(`CEP ${c.zipCode}`)
  return parts.join(', ')
}

function buildServicesSection(services: OrdemPrintData['services']): string {
  if (!services || services.length === 0) return ''
  const rows = services
    .map((s) => {
      const desc = (s.description ?? '').toString().trim() || '-'
      const valueCents = Math.max(0, Number(s.valueCents) || 0)
      const costCents = Math.max(0, Number(s.costCents) || 0)
      return `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px;">${desc}</td>
            <td style="text-align: right; padding: 6px 8px;">${formatCentsBr(valueCents)}</td>
            <td style="text-align: right; padding: 6px 8px;">${formatCentsBr(costCents)}</td>
          </tr>`
    })
    .join('')
  const totalCents = services.reduce(
    (acc, s) => acc + Math.max(0, Number(s.valueCents) || 0),
    0
  )
  return `
  <div class="section">
    <h2>Serviços a realizar</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="border-bottom: 1px solid #ddd;">
          <th style="text-align: left; padding: 6px 8px; color: #666;">Descrição</th>
          <th style="text-align: right; padding: 6px 8px; color: #666;">Valor</th>
          <th style="text-align: right; padding: 6px 8px; color: #666;">Custo</th>
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

/**
 * Gera o HTML completo para impressão da ordem de serviço.
 * @param data - Dados da ordem
 * @param company - Dados da empresa (opcional)
 * @param baseUrl - URL base para resolver logos relativos (ex: window.location.origin ou site URL)
 */
export function buildOrdemPrintHtml(
  data: OrdemPrintData,
  company?: CompanyPrintData | null,
  baseUrl: string = ''
): string {
  const logoFullUrl = company?.logoUrl
    ? company.logoUrl.startsWith('http')
      ? company.logoUrl
      : `${baseUrl}${company.logoUrl.startsWith('/') ? company.logoUrl : '/' + company.logoUrl}`
    : ''
  const customerName = data.customer.isCompany
    ? (data.customer.companyName || data.customer.fullName || '-')
    : (data.customer.fullName || '-')
  const companyName = company?.name || 'Conectize'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS #${data.displayNumber ?? ''} - Conectize</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4; color: #111; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 8px; border-bottom: 2px solid #0ea5e9; padding-bottom: 8px; }
    h2 { font-size: 13px; margin: 16px 0 6px; color: #555; }
    .section { margin-bottom: 16px; }
    .row { display: flex; margin-bottom: 4px; }
    .label { min-width: 140px; color: #666; }
    .value { flex: 1; }
    .block { margin-top: 8px; white-space: pre-wrap; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
    .print-header img { max-height: 56px; object-fit: contain; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { .print-header img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${company && (company.name || company.logoUrl || company.address || company.cnpj) ? `
  <div class="print-header" style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #0ea5e9;">
    ${logoFullUrl ? `<img src="${logoFullUrl}" alt="Logo" style="height: 48px; width: auto;" onerror="this.style.display='none'" />` : ''}
    <div style="flex: 1;">
      ${company.name ? `<div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">${company.name}</div>` : ''}
      ${company.cnpj ? `<div style="font-size: 11px; color: #555;">CNPJ ${formatCompanyCnpj(company.cnpj)}</div>` : ''}
      ${buildCompanyAddress(company) ? `<div style="font-size: 11px; color: #555; margin-top: 4px;">${buildCompanyAddress(company)}</div>` : ''}
      ${company.phone || company.email ? `<div style="font-size: 11px; color: #555; margin-top: 2px;">${[company.phone, company.email].filter(Boolean).join(' • ')}</div>` : ''}
    </div>
  </div>
  ` : ''}
  <h1>Ordem de Serviço #${data.displayNumber ?? '-'} — ${companyName}</h1>
  <p style="margin-bottom: 12px;">${data.title}</p>
  <p><strong>Status:</strong> ${formatStatus(data.status)} | <strong>Data:</strong> ${formatDate(data.createdAt)}</p>

  <div class="section">
    <h2>Cliente</h2>
    <div class="row"><span class="label">Nome:</span><span class="value">${customerName}</span></div>
    <div class="row"><span class="label">Documento:</span><span class="value">${formatDoc(data.customer.isCompany ? data.customer.cnpj : data.customer.cpf, data.customer.isCompany)}</span></div>
    <div class="row"><span class="label">E-mail:</span><span class="value">${data.customer.email || '-'}</span></div>
    <div class="row"><span class="label">Celular:</span><span class="value">${data.customer.mobilePhone || '-'}</span></div>
    <div class="row"><span class="label">Contato:</span><span class="value">${data.customer.contactPhone || '-'}${data.customer.contactNotes ? ` — ${data.customer.contactNotes}` : ''}</span></div>
    <div class="row"><span class="label">Endereço:</span><span class="value">${data.customer.addressFull || '-'}</span></div>
  </div>

  <div class="section">
    <h2>Equipamento</h2>
    <div class="row"><span class="label">Dispositivo:</span><span class="value">${data.device || '-'}</span></div>
    <div class="row"><span class="label">IMEI/Série:</span><span class="value">${data.imei || '-'}</span></div>
    <div class="row"><span class="label">Garantia:</span><span class="value">${data.isWarranty ? 'Sim' : 'Não'}</span></div>
    <div class="row"><span class="label">Previsão:</span><span class="value">${formatDate(data.estimatedReadyAt)}</span></div>
  </div>

  ${data.customerDescription ? `<div class="section"><h2>Descrição</h2><div class="block">${data.customerDescription}</div></div>` : ''}
  ${data.receivingNotes ? `<div class="section"><h2>Observações do recebimento</h2><div class="block">${data.receivingNotes}</div></div>` : ''}
  ${data.assistanceInfo ? `<div class="section"><h2>Informações sobre a assistência</h2><div class="block">${data.assistanceInfo}</div></div>` : ''}
  ${buildServicesSection(data.services)}

  <div class="section" style="margin-top: 24px;">
    <div style="border-top: 1px solid #333; padding-top: 16px; margin-top: 32px;">
      <div style="height: 56px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>
      <p style="font-size: 11px; color: #555;">Assinatura do cliente</p>
      <p style="font-size: 11px; font-weight: 600; margin-top: 2px;">${customerName}</p>
    </div>
  </div>

  <div class="footer">
    Impresso em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${companyName}${companyName === 'Conectize' ? ' Assistência Técnica' : ''}
  </div>

  <script>
    window.onload = function() {
      var img = document.querySelector('.print-header img');
      var done = false;
      function doPrint() { if (!done) { done = true; window.print(); } }
      if (img) {
        img.onload = img.onerror = function() { setTimeout(doPrint, 50); };
        if (img.complete) setTimeout(doPrint, 100);
        setTimeout(doPrint, 2500);
      } else {
        setTimeout(doPrint, 100);
      }
    };
  </script>
</body>
</html>
`
}
