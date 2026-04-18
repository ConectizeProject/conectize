const WINDOW_MS = 2500

/**
 * Evita sondagem duplicada de sessão na página de login (ex.: React Strict Mode em dev),
 * que dobrava fetch ao Supabase e reativava auto-refresh no cleanup.
 */
export function shouldSkipDuplicateLoginSessionProbe (): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & { __conectizeLoginProbeAt?: number }
  const now = Date.now()
  const last = w.__conectizeLoginProbeAt
  if (last !== undefined && now - last < WINDOW_MS) {
    return true
  }
  w.__conectizeLoginProbeAt = now
  return false
}
