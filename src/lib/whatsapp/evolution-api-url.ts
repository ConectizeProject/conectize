function envEvolutionApiUrl (): string {
  return (process.env.WHATSAPP_EVOLUTION_API_URL || '').trim().replace(/\/$/, '')
}

function allowLocalEvolutionHosts (): boolean {
  return process.env.NODE_ENV !== 'production'
}

function stripIpv6Brackets (hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
}

function isIpv4Literal (host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

function isBlockedIpv4 (host: string, allowLocal: boolean): boolean {
  const parts = host.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 127) return !allowLocal
  if (a === 10) return !allowLocal
  if (a === 192 && b === 168) return !allowLocal
  if (a === 172 && b >= 16 && b <= 31) return !allowLocal
  if (a === 100 && b >= 64 && b <= 127) return !allowLocal
  return false
}

function isBlockedHostname (hostname: string, allowLocal: boolean): boolean {
  const host = stripIpv6Brackets(hostname)
  if (!host) return true
  if (
    host === 'metadata.google.internal'
    || host === 'metadata.internal'
    || host.endsWith('.internal')
  ) {
    return true
  }
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
  ) {
    return !allowLocal
  }
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return !allowLocal
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return !allowLocal
  }
  if (isIpv4Literal(host)) return isBlockedIpv4(host, allowLocal)
  return false
}

export function normalizeEvolutionApiBaseUrl (raw: string): string {
  return String(raw || '').trim().replace(/\/$/, '')
}

export function isTrustedEvolutionEnvBaseUrl (raw: string): boolean {
  const candidate = normalizeEvolutionApiBaseUrl(raw)
  const trusted = envEvolutionApiUrl()
  if (!candidate || !trusted) return false
  try {
    const left = new URL(candidate)
    const right = new URL(trusted)
    return left.origin === right.origin && left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '')
  } catch {
    return candidate === trusted
  }
}

/**
 * URL da Evolution que o servidor pode buscar.
 * Em produção bloqueia http (exceto a URL de env), hosts locais e IPs privados.
 */
export function sanitizeEvolutionApiBaseUrl (raw: string): string | null {
  const trimmed = normalizeEvolutionApiBaseUrl(raw)
  if (!trimmed) return null

  if (isTrustedEvolutionEnvBaseUrl(trimmed)) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.username || parsed.password) return null
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

  const allowLocal = allowLocalEvolutionHosts()
  if (parsed.protocol === 'http:' && !allowLocal) return null
  if (isBlockedHostname(parsed.hostname, allowLocal)) return null

  return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '')
}
