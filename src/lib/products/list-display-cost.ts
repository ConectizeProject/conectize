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
