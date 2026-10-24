export type LojaWhatsAppPlacement =
	| 'header'
	| 'hero'
	| 'fab'
	| 'contato'

type GtagFn = (
	command: 'event' | 'config' | 'js' | 'set',
	...args: unknown[]
) => void

declare global {
	interface Window {
		gtag?: GtagFn
		dataLayer?: unknown[]
	}
}

export type BookingFunnelStep =
	| 'view_offer'
	| 'start_booking'
	| 'select_model'
	| 'select_date'
	| 'select_slot'
	| 'submit_attempt'
	| 'submit_booking'
	| 'booking_error'
	| 'booking_extra_prompt'
	| 'booking_blocked'
	| 'whatsapp_request'
	| 'whatsapp_change'
	| 'whatsapp_existing'
	| 'account_start'
	| 'account_created'

export type BookingFunnelDetail = {
	model?: string
	date?: string
	slot?: string
	error?: string
}

const concludedBookingKeys = new Set<string>()

const PII_PATTERNS = [
	/[^\s@]+@[^\s@]+\.[^\s@]+/g,
	/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
	/\+?\d[\d\s().-]{8,}\d/g,
]

/** Mensagem de erro para analytics: sem e-mail, CPF, telefone ou nome. */
export function sanitizeBookingError (raw: unknown, fallback = 'desconhecido'): string {
	let text = ''
	if (typeof raw === 'string') {
		text = raw
	} else if (raw instanceof Error) {
		text = raw.message || raw.name
	} else if (raw && typeof raw === 'object' && 'message' in raw) {
		text = String((raw as { message?: unknown }).message || '')
	} else if (raw != null) {
		text = String(raw)
	}
	for (const pattern of PII_PATTERNS) {
		text = text.replace(pattern, '[redacted]')
	}
	text = text.replace(/\s+/g, ' ').trim().slice(0, 160)
	const slug = text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9._:-]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 80)
	return slug || fallback
}

/** Uma vez por agendamento concluído. Sem nome, CPF, telefone ou e-mail. */
export function trackAgendamentoConcluido (detail: {
	modelo: string
	dataAgendada: string
	horario: string
}) {
	const modelo = String(detail.modelo || '').trim()
	const dataAgendada = String(detail.dataAgendada || '').trim()
	const horario = String(detail.horario || '').trim()
	if (!modelo || !dataAgendada || !horario) return
	const key = `${modelo}|${dataAgendada}|${horario}`
	if (concludedBookingKeys.has(key)) return
	if (typeof window.gtag !== 'function') return
	concludedBookingKeys.add(key)
	window.gtag('event', 'agendamento_concluido', {
		modelo,
		data_agendada: dataAgendada,
		horario,
		page_path: window.location.pathname,
	})
}

export function trackBookingFunnel (step: BookingFunnelStep, detail?: BookingFunnelDetail) {
	if (typeof window.gtag !== 'function') return
	const model = String(detail?.model || '').trim()
	const date = String(detail?.date || '').trim()
	const slot = String(detail?.slot || '').trim()
	const error = sanitizeBookingError(detail?.error, '')
	window.gtag('event', step, {
		event_category: 'agendamento',
		event_label: error || model || 'troca-de-bateria',
		page_path: window.location.pathname,
		booking_model: model || undefined,
		booking_date: date || undefined,
		booking_slot: slot || undefined,
		error: error || undefined,
	})
}

/** Um único evento de clique no WhatsApp. Sem clique_whatsapp nem conversion_event_outbound_click. */
export function trackWhatsAppClick (detail: {
	page_path: string
	link_url: string
}) {
	if (typeof window.gtag !== 'function') return
	const page_path = String(detail.page_path || '').trim()
	const link_url = String(detail.link_url || '').trim()
	if (!page_path || !link_url) return
	window.gtag('event', 'whatsapp_click', {
		page_path,
		link_url,
	})
}

/**
 * Clique em telefone — conversão complementar útil para Ads locais.
 */
export function trackLojaPhoneClick (placement = 'loja_phone'): void {
	if (typeof window.gtag !== 'function') return
	window.gtag('event', 'phone_click', {
		event_category: 'loja',
		event_label: placement,
	})
}
