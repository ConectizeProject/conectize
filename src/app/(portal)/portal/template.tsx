import { PortalPageTransition } from './PortalPageTransition'

/**
 * template remonta a cada navegação (diferente do layout),
 * o que permite enter/exit das View Transitions.
 */
export default function PortalTemplate ({ children }: { children: React.ReactNode }) {
  return <PortalPageTransition>{children}</PortalPageTransition>
}
