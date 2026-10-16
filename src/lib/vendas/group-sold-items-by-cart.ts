/** Agrupa itens do mesmo carrinho MELI (pack_id), preservando a ordem da primeira ocorrência. */
export function groupSoldItemsByCart <T extends {
  id: string
  order: { mlPackId?: string | null }
}> (items: T[]): T[][] {
  const groups: T[][] = []
  const packGroupIndex = new Map<string, number>()

  for (const item of items) {
    const packId = String(item.order.mlPackId || '').trim()
    if (packId) {
      const existing = packGroupIndex.get(packId)
      if (existing != null) {
        groups[existing].push(item)
        continue
      }
      packGroupIndex.set(packId, groups.length)
    }
    groups.push([item])
  }

  return groups
}

/**
 * Reordena a lista para manter itens do mesmo pack adjacentes
 * (evita cortar o carrinho no meio da página).
 */
export function keepSoldItemPacksTogether <T extends {
  id: string
  sortAt: number
  order: { mlPackId?: string | null }
}> (items: T[]): T[] {
  return groupSoldItemsByCart(items).flatMap((group) =>
    group.slice().sort((a, b) => b.sortAt - a.sortAt || a.id.localeCompare(b.id)),
  )
}
