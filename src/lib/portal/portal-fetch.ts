'use client'

type PortalFetchOptions = RequestInit & {
  redirectTo?: string
}

function getCurrentPath() {
  if (typeof window === 'undefined') return '/portal'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function redirectToLogin(redirectTo?: string) {
  if (typeof window === 'undefined') return
  const next = redirectTo || getCurrentPath()
  const url = `/portal/login?redirectTo=${encodeURIComponent(next)}`
  window.location.assign(url)
}

export async function portalFetch(input: RequestInfo | URL, init?: PortalFetchOptions) {
  const res = await fetch(input, init)

  if (res.status === 401) {
    redirectToLogin(init?.redirectTo)
    return res
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return res

  const cloned = res.clone()
  const data = await cloned.json().catch(() => null)
  if (data?.error === 'not_authenticated') {
    redirectToLogin(init?.redirectTo)
  }

  return res
}

