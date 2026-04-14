/**
 * Cálculo do **preço de venda sugerido ao consumidor** (espelha a função SQL
 * `public.portal_retailer_catalog_prices` e os comentários em `pricing_tags`).
 *
 * ## Margem sobre o preço de venda (não sobre custo)
 *
 * `marginBps` é a margem desejada **em relação ao preço de venda final** (o valor
 * com margem já embutida), em basis points: 1 bp = 0,01 % (10 000 bps = 100 %).
 * Ou seja, a margem é uma fração do **preço sugerido final**, não do custo nem do
 * `baseSaleCents` sozinho.
 *
 * Com preço de lista / base `S` centavos e margem `m` bps válida (0 < m < 10 000),
 * o valor antes do piso mínimo é:
 *
 *   `ceil(S * 10 000 / (10 000 - m))`
 *
 * (equivalente a “subir” o preço de lista até que a parcela da margem no final
 * corresponda a `m` bps do total).
 *
 * ## Máximo com mínimo (`max` com piso)
 *
 * O valor entregue ao lojista é o **máximo** entre esse valor por margem e o
 * **mínimo efetivo** em centavos (`minSuggestedSaleCents`), quando informado.
 * Se não houver mínimo, o sugerido é só o valor por margem (comportamento idêntico
 * ao `coalesce(min, by_margin)` no SQL).
 *
 * ## Casos limite (alinhados ao SQL)
 *
 * - `baseSaleCents` ausente → retorno `null` (sem sugerido).
 * - `marginBps` ≤ 0 ou ≥ 10 000 → o sugerido por margem é o próprio `baseSaleCents`.
 */
export function suggestedSaleCents (args: {
  baseSaleCents: number | null
  marginBps: number
  minSuggestedSaleCents?: number | null
}): number | null {
  const { baseSaleCents, marginBps, minSuggestedSaleCents } = args
  if (baseSaleCents == null) return null

  const m = Number.isFinite(marginBps) ? marginBps : 0
  let byMargin: number
  if (m <= 0 || m >= 10000) {
    byMargin = baseSaleCents
  } else {
    byMargin = Math.ceil((baseSaleCents * 10000) / (10000 - m))
  }

  if (minSuggestedSaleCents == null) return byMargin
  const minN = Number(minSuggestedSaleCents)
  if (!Number.isFinite(minN) || minN < 0) return byMargin
  return Math.max(byMargin, minN)
}
