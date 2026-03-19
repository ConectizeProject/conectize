import type { LocalProduct } from '@/lib/integrations/bling/mappers'

/**
 * Alvo de estoque a partir do produto já mapeado (GET /produtos/:id).
 * `LocalProduct.estoqueAtual` vem de getStock(): prioriza estoque.saldoVirtualTotal.
 */
export function getVirtualStockTargetFromMappedProduct (local: Pick<LocalProduct, 'estoqueAtual'>): number | null {
  if (typeof local.estoqueAtual !== 'number' || !Number.isFinite(local.estoqueAtual)) return null
  return Math.round(local.estoqueAtual)
}

function readNumber (v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.round(v)
}

/**
 * Saldo virtual a partir da resposta de GET /produtos/:id/estoque (formato Bling v3).
 * Prioridade: saldoVirtualTotal → saldoVirtual → estoqueAtual (legado).
 */
export function getVirtualStockFromEstoqueApiResponse (data: unknown): number | null {
  const root = data !== null && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  const inner = root.data !== null && typeof root.data === 'object' && !Array.isArray(root.data)
    ? (root.data as Record<string, unknown>)
    : root

  return readNumber(inner.saldoVirtualTotal)
    ?? readNumber(inner.saldoVirtual)
    ?? readNumber(inner.estoqueAtual)
}
