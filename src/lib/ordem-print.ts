/**
 * Modelos e configurações de impressão para Ordem de Serviço.
 * Único ponto de verdade para etiqueta e impressão da OS, usado na listagem e na edição.
 * Datas sempre exibidas em horário de Brasília (America/Sao_Paulo).
 */

import { formatDateTimeBr, formatDateTimeShortBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'

// --- Configurações (usadas na listagem e na edição) ---

export const ORDEM_PRINT_CONFIG = {
	/** Dimensões da janela ao abrir a etiqueta para impressão */
	labelWindow: { width: 900, height: 800 },
	/** Dimensões da janela ao abrir a OS para impressão */
	printWindow: { width: 900, height: 800 },
} as const

/** Gera string de opções para window.open (ex: 'width=900,height=800') */
export function getLabelWindowFeatures(): string {
	const { width, height } = ORDEM_PRINT_CONFIG.labelWindow
	return `width=${width},height=${height}`
}

/** Gera string de opções para window.open para impressão da OS */
export function getPrintWindowFeatures(): string {
	const { width, height } = ORDEM_PRINT_CONFIG.printWindow
	return `width=${width},height=${height}`
}

// --- Helpers compartilhados ---

function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	}
	return text.replace(/[&<>"']/g, (m) => map[m])
}

// ========== ETIQUETA ==========
// Tamanho físico: 45mm x 25mm

export type OrdemLabelData = {
	displayNumber: string | number
	title: string
	createdAt: string
	estimatedReadyAt: string | null
	passcodeType: 'text' | 'pattern' | null
	passcodeText: string | null
	passcodePattern: string | null
	customerFirstName: string | null
	customerMobile: string | null
	deviceModel: string | null
}

function formatDateShort(value: string | null): string {
	return formatDateTimeShortBr(value)
}

function getPasscodeDisplay(data: OrdemLabelData): string {
	if (data.passcodeType === 'text' && data.passcodeText) {
		return `Senha: ${data.passcodeText}`
	}
	if (data.passcodeType === 'pattern') {
		return `Senha: ${data.passcodePattern}`
	}
	return ''
}

export type BuildOrdemLabelHtmlOptions = {
	/** Se false, não dispara window.print no load (pré-visualização). Default true. */
	autoPrint?: boolean
}

/**
 * Gera o HTML da etiqueta para impressão.
 */
export function buildOrdemLabelHtml(
	data: OrdemLabelData,
	options?: BuildOrdemLabelHtmlOptions,
): string {
	const autoPrint = options?.autoPrint !== false
	const titleDisplay = `#${data.displayNumber} - ${(data.title || '-').slice(0, 35)}`
	const entrada = formatDateShort(data.createdAt)
	const previsao = formatDateShort(data.estimatedReadyAt)
	const senha = getPasscodeDisplay(data)
	const clienteLinha =
		data.customerFirstName || data.customerMobile
			? [data.customerFirstName, data.customerMobile ? formatPhoneBr(data.customerMobile) : null]
				.filter(Boolean)
				.join(' ')
			: null
	const modeloLinha = data.deviceModel || null

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta OS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      width: 45mm;
      min-height: 25mm;
      padding: 2mm 3mm;
      overflow: hidden;
      word-wrap: break-word;
    }
    .label-row { margin-bottom: 1mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-row.date { text-overflow: initial }
    .label-row.label-title { font-weight: 700; font-size: 9px; white-space: normal; word-break: break-word; }
    .label-row:last-child { margin-bottom: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 45mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label-row label-title">${escapeHtml(titleDisplay)}</div>
  ${clienteLinha ? `<div class="label-row">${escapeHtml(clienteLinha)}</div>` : ''}
  ${modeloLinha ? `<div class="label-row">${escapeHtml(modeloLinha)}</div>` : ''}
  <div class="label-row date">${escapeHtml(entrada)} - ${escapeHtml(previsao)}</div>
  <div class="label-row">${escapeHtml(senha)}</div>
  ${autoPrint ? `<script>window.onload = function() { window.print(); }</script>` : ''}
</body>
</html>
`
}

// ========== IMPRESSÃO DA OS ==========

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
	ie?: string | null
}

export type OrdemPrintData = {
	displayNumber: number | string | null
	status: string
	title: string
	createdAt: string
	updatedAt: string
	closedAt?: string | null
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
	deviceLocation: string | null
	isWarranty: boolean
	estimatedReadyAt: string | null
	customerDescription: string | null
	receivingNotes: string | null
	assistanceInfo?: string | null
	warrantyText?: string | null
	services?: Array<{
		description?: string | null
		valueCents?: number | null
		costCents?: number | null
	}> | null
	/** Pagamentos já registrados na OS (cupom térmico). */
	payments?: Array<{
		label: string
		amountCents: number
	}> | null
	deviceEntryChecks?: unknown | null
}

function formatDate(value: string | null): string {
	return formatDateTimeBr(value)
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

function buildCustomerSection(
	customer: OrdemPrintData['customer'],
	customerName: string
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

function buildServicesSection(services: OrdemPrintData['services']): string {
	if (!services || services.length === 0) return ''
	const rows = services
		.map((s) => {
			const desc = (s.description ?? '').toString().trim() || '-'
			const valueCents = Math.max(0, Number(s.valueCents) || 0)
			return `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 8px;">${desc}</td>
            <td style="text-align: right; padding: 6px 8px;">${formatCentsBr(valueCents)}</td>
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
 */
export function buildOrdemPrintHtml(
	data: OrdemPrintData,
	company?: CompanyPrintData | null,
	baseUrl: string = ''
): string {
	// URL do logo: absoluta (http) usa como está; path com / usa em relação à origem da janela de impressão (mesmo domínio)
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
	const companyName = company?.name || ''

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS #${data.displayNumber ?? ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4; color: #111; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 8px; padding-bottom: 8px; }
    h2 { font-size: 13px; margin: 16px 0 6px; color: #555; }
    .section { margin-bottom: 16px; }
    .row { display: flex; margin-bottom: 4px; }
    .label { min-width: 140px; color: #666; }
    .value { flex: 1; }
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
      ${company.name ? `<div style="font-size: 16px; font-weight: 700;">${company.name}</div>` : ''}
      ${company.cnpj ? `<div style="font-size: 11px; color: #555;">CNPJ ${formatCompanyCnpj(company.cnpj)}</div>` : ''}
      ${buildCompanyAddress(company) ? `<div style="font-size: 11px; color: #555;">${buildCompanyAddress(company)}</div>` : ''}
      ${company.phone || company.email ? `<div style="font-size: 11px; color: #555;">${[company.phone, company.email].filter(Boolean).join(' • ')}</div>` : ''}
    </div>
  </div>
  ` : ''}
  <h1>Ordem de Serviço ${data.displayNumber} - ${data.title}</h1>
  <p><strong>Data de início:</strong> ${formatDate(data.createdAt)}${data.closedAt ? ` | <strong>Data de conclusão:</strong> ${formatDate(data.closedAt)}` : ''}</p>

  ${buildCustomerSection(data.customer, customerName)}

  <div class="section">
    <h2>Equipamento</h2>
    <div class="row"><span>${data.device}${data.imei ? ` • IMEI: ${data.imei}` : ''}</span></div>
    ${data.deviceLocation?.trim() ? `<div class="row"><span class="label">Localização</span><span class="value">${escapeHtml(data.deviceLocation.trim())}</span></div>` : ''}
  </div>

  ${data.customerDescription ? `<div class="section"><h2>Descrição</h2><div class="block">${escapeHtml(data.customerDescription)}</div></div>` : ''}
  ${data.receivingNotes ? `<div class="section"><h2>Observações do recebimento</h2><div class="block">${escapeHtml(data.receivingNotes)}</div></div>` : ''}
  ${(() => {
			const checks = data.deviceEntryChecks
			if (!checks || typeof checks !== 'object' || Array.isArray(checks)) return ''
			const c = checks as Record<string, unknown>
			const status = typeof c.status === 'string' ? c.status : null
			const rawChecks = c.checks
			const list =
				rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
					? (rawChecks as Record<string, unknown>)
					: null

			const statusLabel = status
				? ({
					operante: 'Aparelho liga normalmente',
					sem_bateria: 'Aparelho não liga na entrada',
					display_apagado: 'Display apagado/danificado na entrada',
					nao_liga: 'Aparelho não liga na entrada',
				} as Record<string, string>)[status] || status
				: null

			const notTested = status && status !== 'operante'
			if (notTested) {
				return `
      <div class="section">
        <h2>Testes realizados na entrada do aparelho</h2>
        <div class="row"><span>${statusLabel || ''}</span></div>
        <div class="block" style="margin-top: 6px;">
          Não foi possível testar o aparelho na entrada. Será realizada uma análise mais detalhada assim que o dispositivo estiver em situação de teste para gerar o diagnóstico geral, podendo surgir novos serviços após os testes.
        </div>
      </div>
    `
			}

			const labels: Record<string, string> = {
				rear_camera_main: 'Câmera traseira (1x)',
				rear_camera_2x: 'Câmera traseira (2x)',
				rear_camera_3x: 'Câmera traseira (3x)',
				front_camera: 'Câmera frontal',
				microphone: 'Microfone',
				earpiece_speaker: 'Alto-falante de ouvido',
				loudspeaker: 'Alto-falante principal',
				charging_port: 'Carregamento (cabo)',
				wireless_charging: 'Carregamento por indução',
				sim_signal: 'Sinal de operadora',
				wifi: 'Wi‑Fi',
				bluetooth: 'Bluetooth',
				face_touch_id: 'Face ID / Touch ID',
				volume_buttons: 'Botões de volume',
				power_button: 'Botão power',
				vibration: 'Vibração',
				proximity_sensor: 'Sensor de proximidade',
				display_touch: 'Toque na tela',
				display_colors: 'Cores/brilho da tela',
			}

			const normalize = (v: unknown): 'ok' | 'fail' | 'na' | null => {
				if (v === true) return 'ok'
				if (v === false) return 'fail'
				if (v === 'ok' || v === 'fail' || v === 'na') return v
				return null
			}

			const okItems: string[] = []
			const failItems: string[] = []
			const naItems: string[] = []
			if (list) {
				for (const [key, value] of Object.entries(list)) {
					const v = normalize(value)
					const label = labels[key] || key
					if (v === 'ok') okItems.push(label)
					else if (v === 'fail') failItems.push(label)
					else if (v === 'na') naItems.push(label)
				}
			}

			const hasAnyMarked = okItems.length > 0 || failItems.length > 0 || naItems.length > 0
			if (!notTested && !hasAnyMarked) return ''

			if (failItems.length > 0) {
				return `
      <div class="section">
        <h2>Testes realizados na entrada do aparelho</h2>
        <div class="row"><span>${statusLabel || 'Aparelho liga normalmente'}</span></div>
        <div class="block" style="margin-top: 6px;">
          <strong>Problemas identificados:</strong> ${failItems.join(', ')}.
          <br/><br/>
          O aparelho foi testado no momento da análise. Os itens acima apresentaram falha e devem ser considerados no diagnóstico e nos serviços.
        </div>
      </div>
    `
			}

			if (okItems.length > 0 || naItems.length > 0) {
				return `
      <div class="section">
        <h2>Testes realizados na entrada do aparelho</h2>
        <div class="row"><span>${statusLabel || 'Aparelho liga normalmente'}</span></div>
        <div class="block" style="margin-top: 6px;">
          O aparelho foi testado no momento da análise e está tudo em ordem.
        </div>
      </div>
    `
			}

			return ''
		})()}
  ${data.warrantyText ? `<div class="section"><h2>Termos de garantia</h2><div class="block">${escapeHtml(data.warrantyText)}</div></div>` : ''}
  ${data.assistanceInfo ? `<div class="section"><h2>Informações sobre a assistência</h2><div class="block">${escapeHtml(data.assistanceInfo)}</div></div>` : ''}
  ${buildServicesSection(data.services)}

  <div class="section">
    <div style="height: 56px; border-bottom: 1px solid #ccc; margin-bottom: 6px; width: 50%;"></div>
    <p style="font-size: 11px; color: #555;">Assinatura do cliente</p>
    <p style="font-size: 11px; font-weight: 600; margin-top: 2px;">${customerName}</p>
  </div>

  <div class="footer">
    Impresso em ${formatDateTimeBr(new Date())} - ${companyName}
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
