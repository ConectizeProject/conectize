import { ViewTransition } from 'react'

/**
 * Transições de página do portal.
 * - Sem tipo (sidebar / navegação lateral): fade
 * - nav-forward / nav-back: slide (lista → detalhe e voltar)
 */
export function PortalPageTransition ({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        default: 'fade-in',
      }}
      exit={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        default: 'fade-out',
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
