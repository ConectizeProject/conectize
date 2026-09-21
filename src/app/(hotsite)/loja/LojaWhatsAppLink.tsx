'use client'

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import {
	type LojaWhatsAppPlacement,
	trackLojaWhatsAppClick,
} from '@/lib/analytics/loja-conversions'

type LojaWhatsAppLinkProps = Omit<
	ComponentPropsWithoutRef<'a'>,
	'href' | 'onClick' | 'target' | 'rel'
> & {
	href: string
	placement: LojaWhatsAppPlacement
	children: ReactNode
}

export function LojaWhatsAppLink ({
	href,
	placement,
	children,
	...rest
}: LojaWhatsAppLinkProps) {
	function handleClick (event: MouseEvent<HTMLAnchorElement>) {
		event.preventDefault()
		trackLojaWhatsAppClick(href, placement)
	}

	return (
		<a
			{...rest}
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={handleClick}
			data-conversion="whatsapp"
			data-placement={placement}
		>
			{children}
		</a>
	)
}
