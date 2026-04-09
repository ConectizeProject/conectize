/**
 * Logs no terminal (Node) para depurar redirect → login.
 * Ative em dev automaticamente, ou em qualquer ambiente com DEBUG_PORTAL_REDIRECT=1
 */
export function logPortalRedirect (step: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development' && process.env.DEBUG_PORTAL_REDIRECT !== '1') {
    return
  }
  console.log('[portal-redirect]', step, details)
}
