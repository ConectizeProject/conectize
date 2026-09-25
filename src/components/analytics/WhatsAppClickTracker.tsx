'use client'

import { useEffect } from 'react'

type GtagFn = (
	command: 'event' | 'config' | 'js' | 'set',
	...args: unknown[]
) => void

declare global {
	interface Window {
		gtag?: GtagFn
	}
}

const WHATSAPP_ANCHOR_SELECTOR =
	'a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"]'

function isWhatsAppHref (href: string) {
	try {
		const url = new URL(href, window.location.origin)
		const host = url.hostname.replace(/^www\./, '')
		return (
			host === 'wa.me' ||
			host === 'api.whatsapp.com' ||
			(host === 'whatsapp.com' && url.pathname.startsWith('/send'))
		)
	} catch {
		return /wa\.me|api\.whatsapp\.com|whatsapp\.com\/send/i.test(href)
	}
}

/**
 * Listener único (delegação) para cliques em links de WhatsApp no site inteiro.
 * Dispara os mesmos eventos GA4 usados na /loja, sem preventDefault.
 */
export function WhatsAppClickTracker () {
	useEffect(() => {
		function handleClick (event: MouseEvent) {
			if (typeof window.gtag !== 'function') return

			const target = event.target
			if (!(target instanceof Element)) return

			const anchor = target.closest(WHATSAPP_ANCHOR_SELECTOR)
			if (!(anchor instanceof HTMLAnchorElement)) return
			if (!isWhatsAppHref(anchor.href)) return

			const event_category = location.pathname.startsWith('/loja')
				? 'loja'
				: 'site'
			const event_label = anchor.dataset.placement?.trim() || 'conteudo'
			const link_url = anchor.href
			const page_path = location.pathname

			window.gtag('event', 'conversion_event_outbound_click', {
				event_category,
				event_label,
				link_url,
				page_path,
				event_timeout: 2000,
			})
			window.gtag('event', 'whatsapp_click', {
				event_category,
				event_label,
				link_url,
				page_path,
			})
			window.gtag('event', 'clique_whatsapp', {
				link_url,
				page_path,
			})
		}

		document.addEventListener('click', handleClick, true)
		return () => document.removeEventListener('click', handleClick, true)
	}, [])

	return null
}
