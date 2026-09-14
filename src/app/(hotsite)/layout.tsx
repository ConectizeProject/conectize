import type { Viewport } from 'next'

export const viewport: Viewport = {
	colorScheme: 'light',
	themeColor: '#ffffff',
}

export default function HotsiteLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
