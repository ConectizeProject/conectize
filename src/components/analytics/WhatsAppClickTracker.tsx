'use client'

import { useEffect } from 'react'
import { trackWhatsAppClick } from '@/lib/analytics/loja-conversions'
import { ensureWhatsAppOriginText } from '@/lib/data/business'

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
 * Dispara só whatsapp_click, sem preventDefault.
 */
export function WhatsAppClickTracker () {
	useEffect(() => {
		function handleClick (event: MouseEvent) {
			const target = event.target
			if (!(target instanceof Element)) return

			const anchor = target.closest(WHATSAPP_ANCHOR_SELECTOR)
			if (!(anchor instanceof HTMLAnchorElement)) return
			if (!isWhatsAppHref(anchor.href)) return

			const nextHref = ensureWhatsAppOriginText(anchor.href, location.pathname)
			if (nextHref !== anchor.href) anchor.href = nextHref

			trackWhatsAppClick({
				page_path: location.pathname,
				link_url: anchor.href,
			})
		}

		document.addEventListener('click', handleClick, true)
		return () => document.removeEventListener('click', handleClick, true)
	}, [])

	return null
}
