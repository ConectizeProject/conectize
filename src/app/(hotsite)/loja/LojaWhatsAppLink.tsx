'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { LojaWhatsAppPlacement } from '@/lib/analytics/loja-conversions'

type LojaWhatsAppLinkProps = Omit<
	ComponentPropsWithoutRef<'a'>,
	'href' | 'target' | 'rel'
> & {
	href: string
	placement: LojaWhatsAppPlacement
	children: ReactNode
}

/** Link de WhatsApp da /loja. Tracking via WhatsAppClickTracker global. */
export function LojaWhatsAppLink ({
	href,
	placement,
	children,
	...rest
}: LojaWhatsAppLinkProps) {
	return (
		<a
			{...rest}
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			data-conversion="whatsapp"
			data-placement={placement}
		>
			{children}
		</a>
	)
}
