export type PaymentAmountRow = {
  type: string
  valueCents: number
}

/** Reparte `totalCents` na proporção dos pesos. A soma fecha no total. */
export function allocateCentsByWeight (weights: number[], totalCents: number): number[] {
  const total = Math.max(0, Math.round(totalCents || 0))
  if (weights.length === 0) return []
  if (weights.length === 1) return [total]
  const safe = weights.map((weight) => Math.max(0, Math.round(weight || 0)))
  const sum = safe.reduce((acc, weight) => acc + weight, 0)
  if (sum <= 0) {
    return safe.map((_, index) => (index === safe.length - 1 ? total : 0))
  }
  const raw = safe.map((weight) => (weight * total) / sum)
  const base = raw.map((value) => Math.floor(value))
  let leftover = total - base.reduce((acc, value) => acc + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  const result = [...base]
  for (const item of order) {
    if (leftover <= 0) break
    result[item.index] += 1
    leftover -= 1
  }
  return result
}

/**
 * Atualiza os valores pagos para somar o total da nota.
 * `type` "90" (sem pagamento) permanece zerado.
 */
export function syncAmountRowsToTotal (rows: PaymentAmountRow[], totalCents: number): number[] {
  const total = Math.max(0, Math.round(totalCents || 0))
  if (rows.length === 0) return []
  const result = rows.map((row) => (row.type === '90' ? 0 : Math.max(0, Math.round(row.valueCents || 0))))
  const payableIndexes = rows
    .map((row, index) => (row.type === '90' ? -1 : index))
    .filter((index) => index >= 0)
  if (payableIndexes.length === 0) return result
  const allocated = allocateCentsByWeight(
    payableIndexes.map((index) => result[index] ?? 0),
    total,
  )
  payableIndexes.forEach((index, position) => {
    result[index] = allocated[position] ?? 0
  })
  return result
}
