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
	}
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
