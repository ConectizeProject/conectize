/**
 * Escolhe a origem usada em redirects de auth: confia no env só quando o host
 * coincide com `liveOrigin` (evita OAuth apontando para localhost com build errado).
 */
export function resolveAuthSiteOrigin (
  fromEnv: string | undefined,
  liveOrigin: string
): string {
  const trimmed = fromEnv?.replace(/\/$/, '').trim()
  if (!trimmed) return liveOrigin
  try {
    const envOrigin = new URL(trimmed).origin
    if (envOrigin === liveOrigin) return trimmed
  } catch {
    return liveOrigin
  }
  return liveOrigin
}

/**
 * Origem absoluta para montar URLs de redirect (OAuth, magic link, recovery, etc.).
 * Durante o SSR do client component retorna string vazia — use em handlers no cliente
 * ou após o mount quando `window` já existir.
 *
 * Se `NEXT_PUBLIC_SITE_URL` estiver definido com outro host (ex.: localhost no build
 * de produção), usa `window.location.origin` para o redirect bater com o domínio real.
 */
export function getAuthSiteOrigin (): string {
  if (typeof window === 'undefined') return ''
  return resolveAuthSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, window.location.origin)
}
