import { cookies } from 'next/headers'

export const PORTAL_ORG_CHECK_COOKIE = 'conectize_portal_org_ok'
const TTL_MS = 10 * 60 * 1000
const MAX_AGE_SEC = 10 * 60

export function portalOrgCheckIsFresh (userId: string, raw: string | undefined | null, now = Date.now()) {
  if (!raw) return false
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return false
  const id = raw.slice(0, dot)
  const at = Number(raw.slice(dot + 1))
  if (id !== userId || !Number.isFinite(at)) return false
  return now - at < TTL_MS
}

export async function readPortalOrgCheckFresh (userId: string) {
  try {
    const cookieStore = await cookies()
    return portalOrgCheckIsFresh(userId, cookieStore.get(PORTAL_ORG_CHECK_COOKIE)?.value)
  } catch {
    return false
  }
}

export async function markPortalOrgChecked (userId: string) {
  try {
    const cookieStore = await cookies()
    cookieStore.set(PORTAL_ORG_CHECK_COOKIE, `${userId}.${Date.now()}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_SEC,
    })
  } catch {
    // Server Components às vezes não podem gravar cookie.
  }
}
