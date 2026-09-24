/**
 * Custo FIFO a partir do histórico de movimentações de estoque.
 * Entradas formam camadas; saídas/perdas consomem as mais antigas primeiro.
 * Sem estoque restante nas camadas → usa o custo do cadastro do produto.
 */

export type FifoMovementInput = {
  type: string
  quantity: number
  unitValueCents: number
}

export type FifoLayer = {
  qty: number
  unitCostCents: number
}

function toPosInt (value: unknown): number {
  const n = Math.trunc(Number(value) || 0)
  return n > 0 ? n : 0
}

export function fifoLayersRemainingQty (layers: FifoLayer[]): number {
  return layers.reduce((acc, layer) => acc + toPosInt(layer.qty), 0)
}

/** Reconstrói camadas restantes após aplicar o histórico em ordem cronológica. */
export function buildFifoLayers (movements: FifoMovementInput[]): FifoLayer[] {
  const layers: FifoLayer[] = []

  for (const mov of movements) {
    const qty = toPosInt(mov.quantity)
    if (qty <= 0) continue
    const type = String(mov.type || '').toLowerCase()

    if (type === 'entry') {
      layers.push({
        qty,
        unitCostCents: Math.max(0, Math.trunc(Number(mov.unitValueCents) || 0)),
      })
      continue
    }

    if (type !== 'exit' && type !== 'loss') continue

    let remaining = qty
    while (remaining > 0 && layers.length > 0) {
      const head = layers[0]
      if (head.qty <= remaining) {
        remaining -= head.qty
        layers.shift()
      } else {
        head.qty -= remaining
        remaining = 0
      }
    }
  }

  return layers
}

/**
 * Consome `quantity` das camadas mais antigas.
 * Sem estoque nas camadas: FIFO não se aplica — usa o custo do cadastro do produto.
 * Se houver estoque parcial, o restante também usa o custo do produto.
 */
export function consumeFifoCost (
  layers: FifoLayer[],
  quantity: number,
  productCostCents = 0,
): {
  totalCostCents: number
  unitCostCents: number
  layers: FifoLayer[]
  usedFifo: boolean
} {
  const need = toPosInt(quantity)
  if (need <= 0) {
    return {
      totalCostCents: 0,
      unitCostCents: 0,
      layers: layers.map((l) => ({ ...l })),
      usedFifo: false,
    }
  }

  const stockQty = fifoLayersRemainingQty(layers)
  const productCost = Math.max(0, Math.trunc(Number(productCostCents) || 0))

  if (stockQty <= 0) {
    return {
      totalCostCents: productCost * need,
      unitCostCents: productCost,
      layers: [],
      usedFifo: false,
    }
  }

  const next = layers.map((l) => ({ ...l }))
  let remaining = need
  let totalCostCents = 0

  while (remaining > 0 && next.length > 0) {
    const head = next[0]
    const take = Math.min(head.qty, remaining)
    totalCostCents += take * Math.max(0, head.unitCostCents)
    head.qty -= take
    remaining -= take
    if (head.qty <= 0) next.shift()
  }

  if (remaining > 0) {
    totalCostCents += remaining * productCost
  }

  const unitCostCents = Math.round(totalCostCents / need)
  return { totalCostCents, unitCostCents, layers: next, usedFifo: true }
}

/** Custo unitário FIFO para `quantity` unidades a partir do histórico completo. */
export function resolveFifoUnitCostCents (
  movements: FifoMovementInput[],
  quantity: number,
  productCostCents = 0,
): number {
  const layers = buildFifoLayers(movements)
  return consumeFifoCost(layers, quantity, productCostCents).unitCostCents
}
