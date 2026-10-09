export const LOJA_WHATSAPP_CONVERSION_EVENT = 'conversion_event_outbound_click'

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
		__conectizeAdsWhatsappSendTo?: string
		__conectizeAdsBookingSendTo?: string
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
	const error = String(detail?.error || '').trim()
	window.gtag('event', step, {
		event_category: 'agendamento',
		event_label: error || model || 'troca-de-bateria',
		page_path: window.location.pathname,
		booking_model: model || undefined,
		booking_date: date || undefined,
		booking_slot: slot || undefined,
	})
	if (step !== 'submit_booking') return
	const sendTo = String(window.__conectizeAdsBookingSendTo || '').trim()
	if (!sendTo) return
	window.gtag('event', 'conversion', { send_to: sendTo })
}

/**
 * Dispara o evento de conversão do Google Ads/GA4 e só então abre o WhatsApp.
 * Se o gtag não estiver pronto, abre o link imediatamente.
 */
export function trackLojaWhatsAppClick (
	url: string,
	placement: LojaWhatsAppPlacement,
): void {
	const openWhatsApp = () => {
		window.open(url, '_blank', 'noopener,noreferrer')
	}

	if (typeof window.gtag !== 'function') {
		openWhatsApp()
		return
	}

	let navigated = false
	const navigateOnce = () => {
		if (navigated) return
		navigated = true
		openWhatsApp()
	}

	window.gtag('event', LOJA_WHATSAPP_CONVERSION_EVENT, {
		event_callback: navigateOnce,
		event_timeout: 2000,
		event_category: 'loja',
		event_label: placement,
		link_url: url,
		outbound: true,
	})

	// Evento paralelo mais legível no GA4 (relatórios / funil).
	window.gtag('event', 'whatsapp_click', {
		event_category: 'loja',
		event_label: placement,
		link_url: url,
	})

	// Conversão clássica do Google Ads (se configurada via env).
	const sendTo = String(window.__conectizeAdsWhatsappSendTo || '').trim()
	if (sendTo) {
		window.gtag('event', 'conversion', {
			send_to: sendTo,
			event_callback: navigateOnce,
			event_timeout: 2000,
		})
	}
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
