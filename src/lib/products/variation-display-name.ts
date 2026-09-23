/**
 * Composição do nome de variação no portal (mesma ideia do import Bling: `Pai attr:valor …`).
 */

const MAX_KEYS = 8
const MAX_KEY_LEN = 48
const MAX_VAL_LEN = 200

export const DEFAULT_VARIATION_ATTRIBUTE_KEY = 'Modelo'

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
 * Formato: «Nome do pai Atributo:valor» (sem espaço após `:`).
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

export type VariationNameSegment = { key: string, value: string }

function preferAttrKeyLabel (a: string, b: string): string {
  const aUpper = [...a].filter((c) => c >= 'A' && c <= 'Z').length
  const bUpper = [...b].filter((c) => c >= 'A' && c <= 'Z').length
  if (bUpper > aUpper) return b
  if (aUpper > bUpper) return a
  return a.length >= b.length ? a : b
}

/** `modelo` → `Modelo`; mantém misturas já capitalizadas. */
export function normalizeVariationAttributeKeyLabel (raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!s) return DEFAULT_VARIATION_ATTRIBUTE_KEY
  if (s.length > MAX_KEY_LEN) return s.slice(0, MAX_KEY_LEN)
  if (s === s.toLowerCase()) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}

/**
 * Extrai segmentos `chave:valor` do restante do nome (após o prefixo do pai).
 * Ex.: `Modelo:8G Black` → [{ key: 'Modelo', value: '8G Black' }]
 */
export function parseVariationTailSegments (tail: string): VariationNameSegment[] {
  const t = String(tail || '').trim()
  if (!t) return []

  const matches = [...t.matchAll(/(\S+?)\s*:\s*/g)]
  if (matches.length === 0) {
    return [{ key: '', value: t.slice(0, MAX_VAL_LEN) }]
  }

  const parts: VariationNameSegment[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const key = String(m[1] || '').trim()
    if (!key || key.length > MAX_KEY_LEN) continue
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? t.length) : t.length
    const value = t.slice(start, end).trim().slice(0, MAX_VAL_LEN)
    if (!value) continue
    parts.push({ key, value })
    if (parts.length >= MAX_KEYS) break
  }
  return parts
}

/**
 * Separa «Nome do pai» do restante («Modelo:valor …») para exibição.
 */
export function splitPortalVariationDisplayName (
  fullName: string,
  parentName?: string | null,
): { parentLabel: string | null, suffix: string } {
  const full = String(fullName || '').trim()
  if (!full) return { parentLabel: null, suffix: '' }

  const parent = String(parentName || '').trim()
  if (parent && full.toLowerCase().startsWith(parent.toLowerCase())) {
    const suffix = full.slice(parent.length).trim()
    if (suffix) {
      return { parentLabel: full.slice(0, parent.length), suffix }
    }
  }

  const m = full.match(/^(.+?)\s+(\S+:\s*.+)$/)
  if (m) {
    const label = m[1].trim()
    const suffix = m[2].trim()
    if (label && suffix) return { parentLabel: label, suffix }
  }

  return { parentLabel: null, suffix: full }
}

/**
 * Interpreta o nome da variação em relação ao pai.
 * - `Display iPhone Modelo:8G Black` → Modelo / 8G Black
 * - `16 Pro Max` (sem prefixo) → valor cru (chave vazia; use `Modelo` na inferência)
 */
export function parseVariationNameAgainstParent (
  parentName: string,
  childName: string,
): VariationNameSegment[] {
  const p = String(parentName || '').trim()
  const c = String(childName || '').trim()
  if (!c) return []

  let rest = c
  if (p && c.toLowerCase().startsWith(p.toLowerCase())) {
    rest = c.slice(p.length).trim()
  }
  if (!rest) return []

  return parseVariationTailSegments(rest)
}

function valuesAlignedToKeys (
  keys: string[],
  segments: VariationNameSegment[],
): Record<string, string> {
  const out: Record<string, string> = {}
  if (keys.length === 0) return out

  const byLow = new Map<string, string>()
  for (const seg of segments) {
    const k = String(seg.key || '').trim()
    const v = String(seg.value || '').trim()
    if (!v) continue
    if (k) byLow.set(k.toLowerCase(), v)
  }

  const unlabeled = segments.filter((s) => !String(s.key || '').trim() && String(s.value || '').trim())

  for (const key of keys) {
    const low = key.toLowerCase()
    if (byLow.has(low)) {
      out[key] = byLow.get(low)!
      continue
    }
    if (keys.length === 1 && unlabeled.length === 1) {
      out[key] = unlabeled[0].value.trim()
    }
  }

  if (Object.keys(out).length === 0 && keys.length === 1 && segments.length === 1) {
    const only = segments[0]
    const v = String(only.value || '').trim()
    if (v) out[keys[0]] = v
  }

  return out
}

/**
 * Infere chaves de atributo a partir dos nomes das variações (quando o pai ainda não tem keys).
 */
export function inferVariationAttributeKeysFromChildNames (
  parentName: string,
  childNames: string[],
): string[] {
  const keyRank = new Map<string, { label: string, count: number }>()

  for (const name of childNames) {
    const segs = parseVariationNameAgainstParent(parentName, name)
    for (const seg of segs) {
      const rawKey = String(seg.key || '').trim()
      if (!rawKey) continue
      const low = rawKey.toLowerCase()
      const prev = keyRank.get(low)
      if (!prev) {
        keyRank.set(low, { label: normalizeVariationAttributeKeyLabel(rawKey), count: 1 })
      } else {
        prev.count += 1
        prev.label = preferAttrKeyLabel(prev.label, normalizeVariationAttributeKeyLabel(rawKey))
      }
    }
  }

  if (keyRank.size === 0) {
    const hasValueOnly = childNames.some((n) => {
      const segs = parseVariationNameAgainstParent(parentName, n)
      return segs.some((s) => String(s.value || '').trim())
    })
    return hasValueOnly ? [DEFAULT_VARIATION_ATTRIBUTE_KEY] : []
  }

  return [...keyRank.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_KEYS)
    .map((x) => x.label)
}

/**
 * Valores + nome alvo para uma variação, dados as chaves do pai.
 */
export function resolveVariationAttributesFromName (
  parentName: string,
  childName: string,
  keys: string[],
): { values: Record<string, string>, displayName: string } {
  const safeKeys = parseVariationAttributeKeys(keys)
  if (safeKeys.length === 0) {
    return { values: {}, displayName: String(childName || '').trim() || String(parentName || '').trim() || 'Produto' }
  }

  const segments = parseVariationNameAgainstParent(parentName, childName)
  let values = valuesAlignedToKeys(safeKeys, segments)

  // Nome curto sem prefixo / sem `chave:` → valor do único atributo
  if (Object.keys(values).length === 0 && safeKeys.length === 1) {
    const c = String(childName || '').trim()
    const p = String(parentName || '').trim()
    if (c && (!p || c.toLowerCase() !== p.toLowerCase())) {
      let rest = c
      if (p && c.toLowerCase().startsWith(p.toLowerCase())) {
        rest = c.slice(p.length).trim()
      }
      if (rest) values = { [safeKeys[0]]: rest.slice(0, MAX_VAL_LEN) }
    }
  }

  const displayName = composePortalVariationDisplayName(parentName, safeKeys, values)
  return { values: parseVariationAttributeValues(values), displayName }
}

export function variationAttributesNeedRepair (input: {
  parentName: string
  parentKeys: string[]
  children: Array<{ name: string, values: Record<string, string> }>
}): boolean {
  const keys = parseVariationAttributeKeys(input.parentKeys)
  if (input.children.length === 0) return false
  if (keys.length === 0) return true

  const parentName = String(input.parentName || '').trim()
  for (const child of input.children) {
    const vals = parseVariationAttributeValues(child.values)
    for (const k of keys) {
      const has = Object.keys(vals).some(
        (vk) => vk.toLowerCase() === k.toLowerCase() && String(vals[vk] || '').trim(),
      )
      if (!has) return true
    }
    const { displayName } = resolveVariationAttributesFromName(parentName, child.name, keys)
    if (displayName && displayName !== String(child.name || '').trim()) return true
  }
  return false
}
