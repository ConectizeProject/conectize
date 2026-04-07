/** Dispara a barra de progresso global (útil antes de `router.push` / `router.replace`). */
export function startNavigationProgress () {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('connectize:navigation-start'))
}
