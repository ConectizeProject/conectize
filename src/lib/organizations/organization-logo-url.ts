import { getSiteUrl } from '@/lib/utils/site-url'

const ORGANIZATION_LOGOS_PUBLIC_PREFIX =
  '/storage/v1/object/public/organization-logos/'

export type OrganizationLogoUrlOptions = {
  siteOrigin?: string
  supabaseUrl?: string
}

function trimTrailingSlash (value: string) {
  return value.replace(/\/+$/, '')
}

function originFrom (raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

export function organizationLogoAllowedOrigins (
  opts?: OrganizationLogoUrlOptions,
): { siteOrigin: string, supabaseOrigin: string | null } {
  const siteRaw = opts?.siteOrigin || getSiteUrl()
  const siteOrigin = originFrom(siteRaw) || getSiteUrl()
  const supabaseRaw = opts?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return {
    siteOrigin: trimTrailingSlash(siteOrigin),
    supabaseOrigin: originFrom(supabaseRaw),
  }
}

export function isAllowedOrganizationLogoUrl (
  logoUrl: string,
  opts?: OrganizationLogoUrlOptions,
): boolean {
  const trimmed = logoUrl.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('//')) return false

  const { siteOrigin, supabaseOrigin } = organizationLogoAllowedOrigins(opts)
  const absolute = trimmed.startsWith('/')
    ? `${siteOrigin}${trimmed}`
    : trimmed

  let parsed: URL
  try {
    parsed = new URL(absolute)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (parsed.username || parsed.password) return false

  const origin = parsed.origin.toLowerCase()
  if (origin === siteOrigin.toLowerCase()) {
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost'
  }

  if (supabaseOrigin && origin === supabaseOrigin.toLowerCase()) {
    return (
      parsed.protocol === 'https:'
      && parsed.pathname.startsWith(ORGANIZATION_LOGOS_PUBLIC_PREFIX)
    )
  }

  return false
}

export function resolveAllowedOrganizationLogoFetchUrl (
  logoUrl: string,
  opts?: OrganizationLogoUrlOptions,
): string {
  const trimmed = logoUrl.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return ''

  const { siteOrigin } = organizationLogoAllowedOrigins(opts)
  const absolute = trimmed.startsWith('/')
    ? `${siteOrigin}${trimmed}`
    : trimmed

  return isAllowedOrganizationLogoUrl(absolute, opts) ? absolute : ''
}
