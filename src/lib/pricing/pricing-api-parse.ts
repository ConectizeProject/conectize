export type ParseInvalid = { readonly _tag: 'invalid' }
export const PARSE_INVALID: ParseInvalid = { _tag: 'invalid' }

export function parseUuid (raw: unknown): string | null {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) return null
  return v
}

export function parseUuidParam (raw: string | null): string | null {
  return parseUuid(raw)
}

export function parseMarginBps (raw: unknown): number | null | undefined | ParseInvalid {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  if (!Number.isInteger(n) || n < 0 || n >= 10000) return PARSE_INVALID
  return n
}

export function parseMinCents (raw: unknown): number | null | undefined | ParseInvalid {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  if (!Number.isInteger(n) || n < 0) return PARSE_INVALID
  return n
}
