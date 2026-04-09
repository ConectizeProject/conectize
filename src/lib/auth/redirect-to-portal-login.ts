import { redirect } from 'next/navigation'

/**
 * Fallback quando o layout/página detecta ausência de sessão após o middleware
 * ter deixado passar (caso raro). O fluxo normal é o middleware 302 com
 * `redirectTo` correto a partir da URL (`pathname` + `search`).
 */
export function redirectToPortalLogin (): never {
  redirect('/portal/login')
}
