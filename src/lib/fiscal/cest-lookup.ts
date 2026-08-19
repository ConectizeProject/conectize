import 'server-only'
import {
  cestPairingMessage,
  evaluateCestForNcm,
  parseCestLookupHtml,
  type CestLookupParse,
} from '@/lib/fiscal/cest'
import { fiscalCestOrNull, fiscalNcmOrNull } from '@/lib/fiscal/ncm'

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

  const lookup = await lookupCestForNcm(ncmDigits)
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

