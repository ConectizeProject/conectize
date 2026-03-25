/**
 * URL absoluta do route handler `/portal/auth/callback` com `redirectTo` na query
 * (troca de código OAuth / sessão e redirects pós-login).
 */
export function buildPortalAuthCallbackUrl (redirectTo: string, siteOrigin: string): string {
  const base =
    siteOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base) {
    throw new Error(
      'buildPortalAuthCallbackUrl: origem do site indisponível (SSR sem siteOrigin)'
    )
  }
  const url = new URL('/portal/auth/callback', base)
  url.searchParams.set('redirectTo', redirectTo)
  return url.toString()
}
