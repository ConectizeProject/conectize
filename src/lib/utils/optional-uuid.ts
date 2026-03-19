/**
 * Radix Select usa "__none__" como valor de item "Nenhum"; isso não é UUID válido.
 * Colunas uuid no Postgres rejeitam esse texto — normalizar para null no servidor e na serialização.
 */
export const SELECT_NONE_VALUE = '__none__'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseOptionalUuid (raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s || s === SELECT_NONE_VALUE) return null
  if (!UUID_RE.test(s)) return null
  return s
}
