/**
 * Preço de venda sugerido ao consumidor (espelha `public.portal_retailer_catalog_prices`).
 *
 * **Base:** custo do produto em centavos (`costCents`). **Margem** (`marginBps`, bps):
 * participação sobre o preço final — (preço − custo) / preço = marginBps / 10 000.
 * Com custo `C` e margem `m` (0 < m < 10 000): preço = ceil(C × 10 000 / (10 000 − m)).
 * Ex.: 50% → m = 5000 → preço ≈ 2× custo; lucro = 50% da receita.
 *
 * **Piso:** `minSuggestedSaleCents` em centavos (R$); o sugerido é max(por margem, mínimo).
 *
 * - `costCents` ausente ou ≤ 0 → `null`.
 * - `marginBps` ≤ 0 ou ≥ 10 000 → sugerido por margem = custo (sem markup pela fórmula).
 */
export function suggestedSaleCents (args: {
  costCents: number | null
  marginBps: number
  minSuggestedSaleCents?: number | null
}): number | null {
  const { costCents, marginBps, minSuggestedSaleCents } = args
  if (costCents == null || costCents <= 0) return null

  const m = Number.isFinite(marginBps) ? marginBps : 0
  let byMargin: number
  if (m <= 0 || m >= 10000) {
    byMargin = costCents
  } else {
    byMargin = Math.ceil((costCents * 10000) / (10000 - m))
  }

  if (minSuggestedSaleCents == null) return byMargin
  const minN = Number(minSuggestedSaleCents)
  if (!Number.isFinite(minN) || minN < 0) return byMargin
  return Math.max(byMargin, minN)
}
