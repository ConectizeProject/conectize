import { maskCest } from '@/lib/fiscal/ncm'
import { onlyDigits } from '@/lib/utils/strings'

export type CestSuggestion = {
  code: string
  label: string
}

export type CestTableStatus = 'in' | 'out' | 'unknown'

export type CestLookupParse = {
  status: CestTableStatus
  suggestions: CestSuggestion[]
}

export type CestPairingReason = 'missing' | 'mismatch' | 'unexpected'

function stripHtml (value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCestSuggestions (plain: string): CestSuggestion[] {
  const matches = plain.matchAll(/(\d{2})\.(\d{3})\.(\d{2})([\s\S]*?)(?=\d{2}\.\d{3}\.\d{2}|⚠|As informações fiscais|Como funciona|$)/g)
  const seen = new Set<string>()
  const suggestions: CestSuggestion[] = []

  for (const match of matches) {
    const code = `${match[1]}${match[2]}${match[3]}`
    if (seen.has(code)) continue
    seen.add(code)

    const rawDescription = String(match[4] || '')
      .replace(/\bCopiar\b/g, ' ')
      .replace(/\bprodutos deste NCM\b/gi, ' ')
      .replace(/\bprodutos\b/gi, ' ')
      .replace(/[↗·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    suggestions.push({
      code,
      label: rawDescription
        ? `${maskCest(code)} - ${rawDescription}`.slice(0, 220)
        : maskCest(code),
    })
    if (suggestions.length >= 12) break
  }

  return suggestions
}

export function parseCestLookupHtml (html: string): CestLookupParse {
  const plain = stripHtml(html)
  const suggestions = parseCestSuggestions(plain)
  if (/não consta na tabela/i.test(plain)) {
    return { status: 'out', suggestions: [] }
  }
  if (suggestions.length > 0 || /está na tabela de Substituição Tributária/i.test(plain)) {
    return { status: 'in', suggestions }
  }
  return { status: 'unknown', suggestions: [] }
}

export function evaluateCestForNcm (input: {
  status: CestTableStatus
  allowedCests: readonly string[]
  cest: string | null
}): { ok: true } | { ok: false, reason: CestPairingReason } {
  const cest = input.cest ? onlyDigits(input.cest) : ''
  const allowed = [...new Set(input.allowedCests.map((code) => onlyDigits(code)).filter((code) => code.length === 7))]

  if (input.status === 'unknown') return { ok: true }

  if (input.status === 'out') {
    if (cest) return { ok: false, reason: 'unexpected' }
    return { ok: true }
  }

  if (!cest) return { ok: false, reason: 'missing' }
  if (allowed.length > 0 && !allowed.includes(cest)) {
    return { ok: false, reason: 'mismatch' }
  }
  return { ok: true }
}

export function cestPairingMessage (
  reason: CestPairingReason,
  input?: { productName?: string, allowedCests?: readonly string[] },
) {
  const product = input?.productName ? ` de "${input.productName}"` : ''
  if (reason === 'missing') {
    return `Informe o CEST${product}. Este NCM está na tabela de Substituição Tributária.`
  }
  if (reason === 'unexpected') {
    return `Remova o CEST${product}. Este NCM não consta na tabela de Substituição Tributária.`
  }
  const allowed = (input?.allowedCests || [])
    .map((code) => maskCest(code))
    .filter(Boolean)
  if (allowed.length === 1) {
    return `O CEST${product} precisa ser ${allowed[0]} para este NCM.`
  }
  if (allowed.length > 1) {
    return `O CEST${product} precisa ser um destes para este NCM: ${allowed.join(', ')}.`
  }
  return `O CEST${product} não combina com o NCM informado.`
}
