import 'server-only'
import {
  cestPairingMessage,
  evaluateCestForNcm,
  ncmListedCodeCoversProduct,
  parseCestLinkedNcms,
  parseCestLookupHtml,
  type CestLookupParse,
  type CestSuggestion,
} from '@/lib/fiscal/cest'
import { fiscalCestOrNull, fiscalNcmOrNull, maskCest } from '@/lib/fiscal/ncm'

const CEST_LOOKUP_URL = 'https://consultaprodutos.com.br/ferramentas/ncm-cest'
const memoryCache = new Map<string, { at: number, result: CestLookupParse }>()
const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function lookupCestForNcm (ncm: unknown): Promise<CestLookupParse> {
  const digits = fiscalNcmOrNull(ncm)
  if (!digits) return { status: 'unknown', suggestions: [] }

  const cached = memoryCache.get(digits)
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.result

  try {
    const res = await fetch(`${CEST_LOOKUP_URL}?q=${encodeURIComponent(digits)}`, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Conectize Fiscal Lookup/1.0',
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) return { status: 'unknown', suggestions: [] }

    const result = parseCestLookupHtml(await res.text())
    memoryCache.set(digits, { at: Date.now(), result })
    return result
  } catch (err) {
    console.warn('[fiscal cest lookup] failed', err)
    return { status: 'unknown', suggestions: [] }
  }
}

async function lookupNcmCodesForCest (cest: string): Promise<string[]> {
  const cached = memoryCache.get(`cest:${cest}`)
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) {
    return cached.result.suggestions.map((item) => item.code)
  }

  try {
    const res = await fetch(`${CEST_LOOKUP_URL}?q=${encodeURIComponent(cest)}`, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Conectize Fiscal Lookup/1.0',
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) return []
    const ncms = parseCestLinkedNcms(await res.text())
    const suggestions: CestSuggestion[] = ncms.map((code) => ({ code, label: code }))
    memoryCache.set(`cest:${cest}`, { at: Date.now(), result: { status: 'in', suggestions } })
    return ncms
  } catch (err) {
    console.warn('[fiscal cest lookup] cest page failed', err)
    return []
  }
}

export async function resolveCestLookup (ncm: unknown, cest?: unknown): Promise<CestLookupParse> {
  const ncmDigits = fiscalNcmOrNull(ncm)
  if (!ncmDigits) return { status: 'unknown', suggestions: [] }

  const base = await lookupCestForNcm(ncmDigits)
  const cestDigits = fiscalCestOrNull(cest)
  if (!cestDigits) return base

  const alreadyListed = base.suggestions.some((item) => fiscalCestOrNull(item.code) === cestDigits)
  if (base.status === 'in' && alreadyListed) return base

  const linkedNcms = await lookupNcmCodesForCest(cestDigits)
  const covered = linkedNcms.some((listed) => ncmListedCodeCoversProduct(listed, ncmDigits))
  if (!covered) return base

  const suggestion: CestSuggestion = {
    code: cestDigits,
    label: `${maskCest(cestDigits)} - posição NCM da tabela de ST`,
  }
  return {
    status: 'in',
    suggestions: [
      suggestion,
      ...base.suggestions.filter((item) => fiscalCestOrNull(item.code) !== cestDigits),
    ],
  }
}

export async function validateCestNcmPair (
  ncm: string | null,
  cest: string | null,
  productName?: string,
): Promise<
  | { ok: true }
  | { ok: false, error: 'cest_required' | 'cest_mismatch' | 'cest_not_required', message: string }
> {
  const ncmDigits = fiscalNcmOrNull(ncm)
  if (!ncmDigits) return { ok: true }

  const lookup = await resolveCestLookup(ncmDigits, cest)
  const pairing = evaluateCestForNcm({
    status: lookup.status,
    allowedCests: lookup.suggestions.map((item) => item.code),
    cest: fiscalCestOrNull(cest),
  })
  if (pairing.ok === false) {
    const error = pairing.reason === 'missing'
      ? 'cest_required' as const
      : pairing.reason === 'unexpected'
        ? 'cest_not_required' as const
        : 'cest_mismatch' as const

    return {
      ok: false,
      error,
      message: cestPairingMessage(pairing.reason, {
        productName,
        allowedCests: lookup.suggestions.map((item) => item.code),
      }),
    }
  }

  return { ok: true }
}

