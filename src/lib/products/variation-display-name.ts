/**
 * Composição do nome de variação no portal (mesma ideia do import Bling: `Pai attr:valor …`).
 */

const MAX_KEYS = 8
const MAX_KEY_LEN = 48
const MAX_VAL_LEN = 200

export function parseVariationAttributeKeys (raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const s = String(item ?? '').trim().replace(/\s+/g, ' ')
    if (!s || s.length > MAX_KEY_LEN) continue
    const low = s.toLowerCase()
    if (seen.has(low)) continue
    seen.add(low)
    out.push(s)
    if (out.length >= MAX_KEYS) break
  }
  return out
}

export function parseVariationAttributeValues (raw: unknown): Record<string, string> {
  if (raw == null || raw === '') return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || '').trim()
    if (!key || key.length > MAX_KEY_LEN) continue
    const val = String(v ?? '').trim()
    if (!val || val.length > MAX_VAL_LEN) continue
    out[key] = val
  }
  return out
}

/**
 * `keys` na ordem de exibição; `values` usa as mesmas strings de chave que o pai.
 */
export function composePortalVariationDisplayName (
  parentName: string,
  keys: string[],
  values: Record<string, string>,
): string {
  const p = String(parentName || '').trim()
  const segments: string[] = []
  for (const rawKey of keys) {
    const key = String(rawKey || '').trim()
    if (!key) continue
    const direct = values[key]
    const loose = Object.keys(values).find((k) => k.toLowerCase() === key.toLowerCase())
    const combined = direct ?? (loose ? values[loose] : '')
    const val = String(combined || '').trim()
    if (!val) continue
    const label = key.replace(/\s+/g, ' ').trim()
    if (!label) continue
    segments.push(`${label}:${val}`)
  }
  if (segments.length === 0) return p || 'Produto'
  if (!p) return segments.join(' ')
  return `${p} ${segments.join(' ')}`.trim()
}
