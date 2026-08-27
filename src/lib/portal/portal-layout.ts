/** Largura máxima compartilhada entre o menu e o conteúdo das páginas do portal. */
export const PORTAL_LAYOUT_CONTAINER =
	'mx-auto w-full max-w-[1680px] px-4 lg:px-6'

/** Conteúdo em tela cheia (sem limite de largura). */
export const PORTAL_FULL_WIDTH_CONTAINER =
	'flex min-h-0 w-full flex-1 flex-col'

const PORTAL_FULL_WIDTH_EXACT: readonly string[] = []

const PORTAL_FULL_WIDTH_PREFIXES: readonly string[] = []

export function isPortalFullWidthPath (pathname: string): boolean {
	if (PORTAL_FULL_WIDTH_EXACT.includes(pathname)) return true
	return PORTAL_FULL_WIDTH_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	)
}

const PORTAL_FILL_VIEWPORT_EXACT: readonly string[] = [
	'/portal/ordens',
]

const PORTAL_FILL_VIEWPORT_PREFIXES: readonly string[] = [
	'/portal/pdv',
	'/portal/whatsapp',
]

/** Páginas que preenchem a área abaixo do header (quadro, PDV, inbox) — o scroll fica no painel interno. */
export function isPortalFillViewportPath (pathname: string): boolean {
	if (PORTAL_FILL_VIEWPORT_EXACT.includes(pathname)) return true
	return PORTAL_FILL_VIEWPORT_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	)
}
