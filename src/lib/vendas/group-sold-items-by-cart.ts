/**
 * Agrupa itens do mesmo carrinho:
 * - pack MELI (`mlPackId`) quando existir
 * - senão o mesmo pedido/OS (`order.id`)
 * Preserva a ordem da primeira ocorrência.
 */
export function groupSoldItemsByCart <T extends {
  id: string
  order: { id?: string | null, mlPackId?: string | null }
}> (items: T[]): T[][] {
  const groups: T[][] = []
  const groupIndex = new Map<string, number>()

  for (const item of items) {
    const packId = String(item.order.mlPackId || '').trim()
    const orderId = String(item.order.id || '').trim()
    const key = packId
      ? `pack:${packId}`
      : orderId
        ? `order:${orderId}`
        : ''

    if (key) {
      const existing = groupIndex.get(key)
      if (existing != null) {
        groups[existing].push(item)
        continue
      }
      groupIndex.set(key, groups.length)
    }
    groups.push([item])
  }

  return groups
}

/**
 * Reordena a lista para manter itens do mesmo pack/pedido adjacentes
 * (evita cortar o carrinho no meio da página).
 */
export function keepSoldItemPacksTogether <T extends {
  id: string
  sortAt: number
  order: { id?: string | null, mlPackId?: string | null, orderNumber?: number }
}> (items: T[]): T[] {
  return groupSoldItemsByCart(items).flatMap((group) =>
    group.slice().sort((a, b) => (
      b.sortAt - a.sortAt
      || (b.order.orderNumber || 0) - (a.order.orderNumber || 0)
      || a.id.localeCompare(b.id)
    )),
  )
}

function sameProductKey (item: {
  productId?: string | null
  productSku?: string | null
  productName?: string | null
}) {
  const productId = String(item.productId || '').trim()
  if (productId) return `id:${productId}`
  const sku = String(item.productSku || '').trim()
  if (sku) return `sku:${sku}`
  return `name:${String(item.productName || '').trim()}`
}

/** Junta linhas do mesmo produto no carrinho (1x + 1x vira 2x). */
export function mergeSameProductLines <T extends {
  productId?: string | null
  productSku?: string | null
  productName?: string | null
}> (items: T[], merge: (kept: T, extra: T) => T): T[] {
  const out: T[] = []
  const indexByKey = new Map<string, number>()
  for (const item of items) {
    const key = sameProductKey(item)
    if (!key || key === 'name:') {
      out.push(item)
      continue
    }
    const existing = indexByKey.get(key)
    if (existing == null) {
      indexByKey.set(key, out.length)
      out.push(item)
      continue
    }
    out[existing] = merge(out[existing], item)
  }
  return out
}
