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
  const live = window.location.origin
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '').trim()
  if (!fromEnv) return live
  try {
    const envOrigin = new URL(fromEnv).origin
    if (envOrigin === live) return fromEnv
  } catch {
    return live
  }
  return live
}
