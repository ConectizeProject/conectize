/** Palavras comuns em nomes de serviço (não ajudam a achar modelo no catálogo). */
const SERVICE_NAME_NOISE = new Set([
  'troca', 'reparo', 'conserto', 'servico', 'serviço', 'original', 'paralela', 'paralelo',
  'display', 'tela', 'bateria', 'conector', 'flex', 'vidro', 'touch', 'traseira', 'dianteira',
  'frontal', 'com', 'sem', 'garantia', 'para', 'por', 'de', 'da', 'do', 'das', 'dos', 'em',
  'no', 'na', 'aos', 'nas', 'premium', 'qualidade', 'cell', 'celular', 'smartphone', 'aparelho',
])

/** Extra: acessórios / rótulos de varejo em nomes de produto. */
const PRODUCT_CATALOG_NOISE = new Set([
  'capa', 'case', 'pelicula', 'película', 'protetor', 'carregador', 'cabo', 'fone', 'suporte', 'kit',
  'unidade', 'peca', 'peça', 'novo', 'lacrado', 'compativel', 'compatível', 'generico', 'genérico',
])

/** Rótulos que separam “modelo:” do código (não são parte do nome do aparelho). */
const STRUCTURAL_TOKENS = new Set(['modelo', 'model', 'mod', 'ref', 'referencia', 'referência'])

/** Marcas comuns no título do produto (minúsculas, sem acento). */
const KNOWN_BRANDS = new Set([
  'samsung', 'galaxy', 'apple', 'iphone', 'motorola', 'moto', 'xiaomi', 'redmi', 'poco', 'lg', 'asus',
  'google', 'pixel', 'oneplus', 'realme', 'oppo', 'nokia', 'sony', 'huawei', 'honor', 'zte', 'tcl',
  'positivo', 'multilaser', 'quantum', 'nubia', 'nothing', 'vivo',
])

function looksLikeModelCodeToken (token: string): boolean {
  const t = String(token || '').toLowerCase()
  if (t.length < 2) return false
  if (/\d/.test(t)) return true
  if (t.length <= 5 && /^(note|tab|neo|max|pro|plus|ultra|lite|mini|fe)$/i.test(t)) return true
  return false
}

function noiseSetForCatalog (catalogKind: 'product' | 'service'): Set<string> {
  return catalogKind === 'product'
    ? new Set([...SERVICE_NAME_NOISE, ...PRODUCT_CATALOG_NOISE])
    : SERVICE_NAME_NOISE
}

export type CatalogModelHints = {
  /** Marcas citadas no título (ex.: samsung). */
  brands: string[]
  /** Códigos após “modelo:” ou tokens tipo S22 / A54. */
  codes: string[]
}

/**
 * Extrai marcas e códigos de modelo do nome (ex.: "Bateria Samsung Modelo:S22" → brands [samsung], codes [s22]).
 */
export function extractCatalogModelHints (
  productName: string,
  catalogKind: 'product' | 'service',
): CatalogModelHints {
  const parts = normalizeForMatch(productName).split(/\s+/).filter(Boolean)
  const noise = noiseSetForCatalog(catalogKind)
  const brands: string[] = []
  for (const p of parts) {
    if (KNOWN_BRANDS.has(p) && !brands.includes(p)) brands.push(p)
  }
  const codes: string[] = []
  const idx = parts.findIndex((x) => STRUCTURAL_TOKENS.has(x))
  if (idx >= 0 && idx < parts.length - 1) {
    const after = parts.slice(idx + 1).filter((t) => !noise.has(t))
    for (const t of after) {
      if (
        t.length >= 2
        && !STRUCTURAL_TOKENS.has(t)
        && !KNOWN_BRANDS.has(t)
        && !codes.includes(t)
      ) {
        codes.push(t)
      }
    }
  }
  for (const p of parts) {
    if (noise.has(p) || STRUCTURAL_TOKENS.has(p)) continue
    if (KNOWN_BRANDS.has(p)) continue
    if (looksLikeModelCodeToken(p) && !codes.includes(p)) codes.push(p)
  }
  return { brands, codes }
}

export type PricingTagLite = { id: string; name: string }

export type DeviceModelCandidate = {
  id: string
  model: string | null
  brand: string | null
}

export function normalizeForMatch (s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Escolhe a tag de precificação cujo nome (normalizado) aparece como substring do nome do item.
 * Prefere o match mais longo (nome da tag mais específico).
 */
export function suggestPricingTagFromName (
  productName: string,
  tags: readonly PricingTagLite[],
): PricingTagLite | null {
  const n = normalizeForMatch(productName)
  if (!n) return null
  let best: PricingTagLite & { score: number } | null = null
  for (const t of tags) {
    const tn = normalizeForMatch(t.name)
    if (tn.length < 3) continue
    if (n.includes(tn)) {
      const score = tn.length
      if (!best || score > best.score) {
        best = { ...t, score }
      }
    }
  }
  if (!best) return null
  const { score: _s, ...rest } = best
  return rest
}

/** Texto usado em `ilike` no modelo (device_models.model) — busca genérica. */
export function deviceModelSearchQueryFromCatalogName (
  productName: string,
  catalogKind: 'product' | 'service',
): string {
  const tokens = normalizeForMatch(productName).split(/\s+/).filter(Boolean)
  const noise = noiseSetForCatalog(catalogKind)
  const kept = tokens.filter(
    (w) => w.length > 1 && !noise.has(w) && !STRUCTURAL_TOKENS.has(w),
  )
  const long = kept.filter((w) => w.length >= 4)
  const codes = kept.filter((w) => looksLikeModelCodeToken(w))
  const merged = [...new Set([...long, ...codes])]
  const base = (merged.length > 0 ? merged : kept).slice(-8).join(' ')
  const q = base.trim().slice(0, 56)
  return q || tokens.filter((w) => w.length > 1).slice(-6).join(' ').slice(0, 48)
}

/**
 * Várias strings de busca `ilike` em `device_models.model`, da mais específica à genérica.
 * Ex.: "Bateria Samsung Modelo:S22" → ["s22", "samsung s22", "samsung s22" deduped, broad…].
 */
export function buildDeviceModelSearchQueries (
  productName: string,
  catalogKind: 'product' | 'service',
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  const push = (raw: string) => {
    const t = String(raw || '').trim().slice(0, 56)
    if (t.length < 2) return
    const k = t.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    ordered.push(t)
  }

  const parts = normalizeForMatch(productName).split(/\s+/).filter(Boolean)
  const noise = noiseSetForCatalog(catalogKind)
  const idx = parts.findIndex((p) => STRUCTURAL_TOKENS.has(p))
  if (idx >= 0 && idx < parts.length - 1) {
    const after = parts.slice(idx + 1).filter((t) => !noise.has(t) && !STRUCTURAL_TOKENS.has(t))
    let brand: string | null = null
    for (let j = idx - 1; j >= 0; j--) {
      if (KNOWN_BRANDS.has(parts[j])) {
        brand = parts[j]
        break
      }
    }
    if (after.length > 0) {
      const slug = after.join(' ')
      if (slug.length >= 2) push(slug)
      for (const seg of after) {
        if (seg.length >= 2 && looksLikeModelCodeToken(seg)) push(seg)
      }
      if (brand) {
        const tail = after[after.length - 1]
        if (tail.length >= 2) push(`${brand} ${tail}`)
      }
    }
  }

  const hints = extractCatalogModelHints(productName, catalogKind)
  for (const c of hints.codes) {
    if (c.length >= 2) push(c)
  }
  for (const b of hints.brands) {
    for (const c of hints.codes) {
      if (c.length >= 2) push(`${b} ${c}`)
    }
  }

  const broad = deviceModelSearchQueryFromCatalogName(productName, catalogKind)
  push(broad)

  return ordered.slice(0, 8)
}

/** @deprecated use {@link deviceModelSearchQueryFromCatalogName}(name, 'service') */
export function deviceModelSearchQueryFromServiceName (productName: string): string {
  return deviceModelSearchQueryFromCatalogName(productName, 'service')
}

function modelLabel (c: DeviceModelCandidate): string {
  return [c.brand, c.model].filter(Boolean).join(' ').trim() || c.model || c.id
}

/**
 * Entre candidatos já filtrados pelo banco, escolhe o que melhor “casa” com o nome do item
 * (marca + modelo do cadastro vs. título do produto).
 */
export function pickBestDeviceModelForCatalogName (
  productName: string,
  catalogKind: 'product' | 'service',
  candidates: readonly DeviceModelCandidate[],
): DeviceModelCandidate | null {
  if (candidates.length === 0) return null
  const pn = normalizeForMatch(productName)
  const hints = extractCatalogModelHints(productName, catalogKind)

  let bestIdx = 0
  let bestScore = -1
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const brandNorm = normalizeForMatch(c.brand || '')
    const mn = normalizeForMatch(c.model || '')
    const full = normalizeForMatch([c.brand, c.model].filter(Boolean).join(' '))

    let score = 0
    if (mn.length >= 3 && pn.includes(mn)) score += mn.length + 28
    if (full.length >= 5 && pn.includes(full)) score += 40

    for (const b of hints.brands) {
      if (b.length < 2) continue
      if (brandNorm === b) score += 34
      else if (brandNorm.includes(b) || b.includes(brandNorm)) score += 24
    }

    for (const code of hints.codes) {
      if (code.length < 2) continue
      if (mn.includes(code) || full.includes(code)) score += 18 + code.length * 2
      if (code.length >= 3 && pn.includes(code) && (mn.includes(code) || full.includes(code))) {
        score += 12
      }
    }

    for (const tok of pn.split(/\s+/)) {
      if (tok.length < 3) continue
      if (mn.includes(tok) || full.includes(tok)) score += tok.length
    }

    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return candidates[bestIdx]
}

/** @deprecated use {@link pickBestDeviceModelForCatalogName}(name, kind, candidates) */
export function pickBestDeviceModelForServiceName (
  productName: string,
  candidates: readonly DeviceModelCandidate[],
): DeviceModelCandidate | null {
  return pickBestDeviceModelForCatalogName(productName, 'service', candidates)
}

export function deviceModelCandidateLabel (c: DeviceModelCandidate): string {
  return modelLabel(c)
}
