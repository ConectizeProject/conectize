'use client'

import { useEffect } from 'react'

export function LojaWhatsAppClickEvent () {
	useEffect(() => {
		function handleClick (event: MouseEvent) {
			const target = event.target
			if (!(target instanceof Element)) return
			const anchor = target.closest('a[href*="wa.me"], a[href*="whatsapp"]')
			if (!(anchor instanceof HTMLAnchorElement)) return
			if (typeof window.gtag !== 'function') return
			window.gtag('event', 'clique_whatsapp', {
				link_url: anchor.href,
				page_path: location.pathname,
			})
		}

		document.addEventListener('click', handleClick)
		return () => document.removeEventListener('click', handleClick)
	}, [])

	return null
}
