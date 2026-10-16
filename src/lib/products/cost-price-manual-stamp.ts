/**
 * Decide se um PATCH de custo deve gravar `cost_price_manual_edited_at`.
 * Reenviar o mesmo centavo do cadastro (o form sempre manda costPrice) não conta.
 */
export function shouldStampCostPriceManualEdit (
  nextCents: number | null | undefined,
  currentCents: number | null | undefined,
): boolean {
  if (nextCents === undefined) return false
  return nextCents !== currentCents
}
