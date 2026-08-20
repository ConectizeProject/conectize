'use client'

type PortalFetchOptions = RequestInit & {
  redirectTo?: string
  /** Se true, nunca redireciona para login (útil no PDV offline). */
  skipAuthRedirect?: boolean
}

function getCurrentPath () {
  if (typeof window === 'undefined') return '/portal'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function isBrowserOffline () {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function redirectToLogin (redirectTo?: string) {
  if (typeof window === 'undefined') return
  // Offline: não expulsar o usuário — cookies/sessão ainda podem estar válidos localmente.
  if (isBrowserOffline()) return
  const next = redirectTo || getCurrentPath()
  const url = `/portal/login?redirectTo=${encodeURIComponent(next)}`
  window.location.assign(url)
}

export async function portalFetch (input: RequestInfo | URL, init?: PortalFetchOptions) {
  const skipAuthRedirect = Boolean(init?.skipAuthRedirect)
  const { redirectTo, skipAuthRedirect: _skip, ...fetchInit } = init || {}

  let res: Response
  try {
    res = await fetch(input, fetchInit)
  } catch (err) {
    // Rede caída / DNS — propaga sem tratar como logout.
    throw err
  }

  if (res.status === 401) {
    if (!skipAuthRedirect) redirectToLogin(redirectTo)
    return res
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return res

  const cloned = res.clone()
  const data = await cloned.json().catch(() => null)
  if (data?.error === 'not_authenticated') {
    if (!skipAuthRedirect) redirectToLogin(redirectTo)
  }

  return res
}
