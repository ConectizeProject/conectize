/**
 * Mesma regra da coluna "Custo" na gestão de produtos: prioriza última entrada de estoque
 * com valor quando é mais recente que o último ajuste manual de custo no cadastro;
 * senão usa `cost_price_cents` do produto; senão o valor da última entrada.
 */
export function resolveListDisplayCostCents (args: {
  costPriceCents: number | null | undefined
  costPriceManualEditedAt: string | null | undefined
  lastEntryUnitValueCents: number | null | undefined
  /** Timestamp da última entrada relevante (ex.: `Date.getTime()`). */
  lastEntryTimeMs: number | null | undefined
}): number | null {
  const rowCost =
    typeof args.costPriceCents === 'number' ? args.costPriceCents : null
  const manualMs = args.costPriceManualEditedAt
    ? new Date(args.costPriceManualEditedAt).getTime()
    : 0
  const entryCents = args.lastEntryUnitValueCents
  const entryMs =
    typeof args.lastEntryTimeMs === 'number' && Number.isFinite(args.lastEntryTimeMs)
      ? args.lastEntryTimeMs
      : 0
  const hasEntry =
    typeof entryCents === 'number' &&
    entryCents > 0 &&
    Number.isFinite(entryMs) &&
    entryMs > 0

  if (hasEntry && entryMs > manualMs) {
    return entryCents
  }
  if (rowCost != null) return rowCost
  if (typeof entryCents === 'number' && entryCents > 0) return entryCents
  return null
}

export type LastEntryCostHint = {
  unitValueCents: number
  timeMs: number
}

/** Atualiza o mapa com a entrada mais recente que tenha valor > 0. */
export function trackLastEntryCost (
  byProductId: Map<string, LastEntryCostHint>,
  productId: string,
  type: string,
  unitValueCents: number,
  createdAt: string | null | undefined,
) {
  if (!productId) return
  if (String(type || '').toLowerCase() !== 'entry') return
  const cents = Math.trunc(Number(unitValueCents) || 0)
  if (cents <= 0) return
  const timeMs = createdAt ? new Date(createdAt).getTime() : NaN
  if (!Number.isFinite(timeMs) || timeMs <= 0) return
  const prev = byProductId.get(productId)
  if (!prev || timeMs >= prev.timeMs) {
    byProductId.set(productId, { unitValueCents: cents, timeMs })
  }
}

/** Custo de exibição (cadastro / última entrada) para fallback quando FIFO não se aplica. */
export function resolveDisplayCostCentsFromHints (args: {
  costPriceCents: number | null | undefined
  costPriceManualEditedAt: string | null | undefined
  lastEntry: LastEntryCostHint | null | undefined
}): number | null {
  return resolveListDisplayCostCents({
    costPriceCents: args.costPriceCents,
    costPriceManualEditedAt: args.costPriceManualEditedAt,
    lastEntryUnitValueCents: args.lastEntry?.unitValueCents ?? null,
    lastEntryTimeMs: args.lastEntry?.timeMs ?? null,
  })
}
