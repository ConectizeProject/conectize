/**
 * URL absoluta do route handler `/portal/auth/callback` com `redirectTo` na query
 * (troca de código OAuth / sessão e redirects pós-login).
 */
export function buildPortalAuthCallbackUrl (redirectTo: string, siteOrigin: string): string {
  const url = new URL('/portal/auth/callback', siteOrigin)
  url.searchParams.set('redirectTo', redirectTo)
  return url.toString()
}
