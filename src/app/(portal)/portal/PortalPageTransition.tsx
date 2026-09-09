import type { ReactNode } from 'react'

/**
 * Antes usava <ViewTransition> com fade/slide.
 * No Safari/iOS isso deixava o header do portal invisível em rotas
 * como OS e aparelhos. Mantemos o wrapper sem animação.
 */
export function PortalPageTransition({ children }: { children: ReactNode }) {
	return children
}
