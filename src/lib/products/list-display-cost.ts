function lastEntryHint (args: {
  lastEntryUnitValueCents: number | null | undefined
  lastEntryTimeMs: number | null | undefined
}): { cents: number, timeMs: number } | null {
  const entryCents = args.lastEntryUnitValueCents
  const entryMs =
    typeof args.lastEntryTimeMs === 'number' && Number.isFinite(args.lastEntryTimeMs)
      ? args.lastEntryTimeMs
      : 0
  if (
    typeof entryCents !== 'number'
    || entryCents <= 0
    || !Number.isFinite(entryMs)
    || entryMs <= 0
  ) {
    return null
  }
  return { cents: entryCents, timeMs: entryMs }
}

function manualEditedAtMs (value: string | null | undefined): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

/**
 * True quando o custo do cadastro (ajuste manual ou `cost_price`) deve prevalecer
 * sobre camadas FIFO: não há entrada de estoque mais recente que o ajuste manual.
 * Assim, editar o custo do produto passa a valer nas próximas vendas.
 */
export function catalogCostPrevailsOverLastEntry (args: {
  costPriceManualEditedAt: string | null | undefined
  lastEntryUnitValueCents: number | null | undefined
  lastEntryTimeMs: number | null | undefined
}): boolean {
  const entry = lastEntryHint(args)
  if (!entry) return true
  return !(entry.timeMs > manualEditedAtMs(args.costPriceManualEditedAt))
}

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
  const entry = lastEntryHint(args)

  if (entry && entry.timeMs > manualEditedAtMs(args.costPriceManualEditedAt)) {
    return entry.cents
  }
  if (rowCost != null) return rowCost
  if (entry) return entry.cents
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

export function catalogCostPrevailsFromHints (args: {
  costPriceManualEditedAt: string | null | undefined
  lastEntry: LastEntryCostHint | null | undefined
}): boolean {
  return catalogCostPrevailsOverLastEntry({
    costPriceManualEditedAt: args.costPriceManualEditedAt,
    lastEntryUnitValueCents: args.lastEntry?.unitValueCents ?? null,
    lastEntryTimeMs: args.lastEntry?.timeMs ?? null,
  })
}
