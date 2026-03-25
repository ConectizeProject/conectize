/**
 * Garante redirect apenas para rotas do portal (`/portal...`), evitando open redirect.
 */
export function assertSafePortalPath (
  redirectTo: string | null | undefined
): string {
  const value = redirectTo?.trim() || '/portal'
  return value.startsWith('/portal') ? value : '/portal'
}
