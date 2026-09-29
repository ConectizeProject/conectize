/**
 * Lançamentos que o staff pode editar/excluir manualmente no painel de estoque.
 * Saídas de venda/OS e demais sources de sistema ficam bloqueados.
 */
export function isStockMovementEditable (
  source: string | null | undefined,
  type: string | null | undefined,
): boolean {
  const normalizedSource = String(source || '').trim().toLowerCase()
  const normalizedType = String(type || '').trim().toLowerCase()
  if (normalizedSource === 'manual') return true
  return normalizedSource === 'bling' && normalizedType === 'entry'
}
