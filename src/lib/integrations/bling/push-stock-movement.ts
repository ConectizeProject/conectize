import { getBlingClientForCurrentUser, normalizeBlingProductId } from '@/lib/integrations/bling/api'
import type { StockMovementType } from '@/lib/products/service'

/** Marcador nos lançamentos enviados pelo portal — o webhook do Bling ecoa o POST e não deve duplicar. */
export const BLING_PORTAL_STOCK_MARKER = 'conectize-portal'

export const PORTAL_STOCK_EXTERNAL_REF_PREFIX = 'portal:stock:'

export function hasPortalStockMarker (text: unknown): boolean {
  if (text == null) return false
  if (typeof text === 'string') return text.includes(BLING_PORTAL_STOCK_MARKER)
  try {
    return JSON.stringify(text).includes(BLING_PORTAL_STOCK_MARKER)
  } catch {
    return false
  }
}

function withPortalStockMarker (observacoes?: string | null): string {
  const base = String(observacoes || '').trim()
  if (!base) return BLING_PORTAL_STOCK_MARKER
  if (base.includes(BLING_PORTAL_STOCK_MARKER)) return base
  return `${base} · ${BLING_PORTAL_STOCK_MARKER}`
}

type StockMovementTypeWithBalance = StockMovementType | 'balance'

type PushStockMovementInput = {
  productBlingId: string
  type: StockMovementTypeWithBalance
  quantity: number
  unitValueCents: number | null
  observacoes?: string | null
}

type DepositRow = {
  id: number
  padrao?: boolean
}

function getOperacao (type: StockMovementTypeWithBalance): 'E' | 'S' | 'B' {
  if (type === 'balance') return 'B'
  if (type === 'entry') return 'E'
  return 'S'
}

function toBlingMoney (unitValueCents: number | null): number | undefined {
  if (unitValueCents === null || !Number.isFinite(unitValueCents) || unitValueCents < 0) return undefined
  const value = unitValueCents / 100
  if (!Number.isFinite(value) || value <= 0) return undefined
  return value
}

export async function pushStockMovementToBling (input: PushStockMovementInput): Promise<void> {
  const idStr = normalizeBlingProductId(input.productBlingId)
  const productIdNum = Number(idStr)
  if (!idStr || !Number.isFinite(productIdNum) || productIdNum <= 0) {
    throw new Error('bling_product_id_invalid')
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    throw new Error(error)
  }

  const deposits = await clientRes.client.request<{ data?: DepositRow[] } | { data?: unknown }>({
    method: 'GET',
    path: '/depositos',
    query: { pagina: 1, limite: 100 },
  })

  const depositRows = (deposits as { data?: DepositRow[] }).data ?? []
  const defaultDeposit = depositRows.find((d) => Boolean(d.padrao)) ?? depositRows[0]
  if (!defaultDeposit?.id) {
    throw new Error('bling_default_deposit_not_found')
  }

  const custo = toBlingMoney(input.unitValueCents)

  const body: Record<string, unknown> = {
    produto: { id: productIdNum },
    deposito: { id: Number(defaultDeposit.id) },
    operacao: getOperacao(input.type),
    quantidade: input.quantity,
  }

  if (typeof custo === 'number') body.custo = custo
  body.observacoes = withPortalStockMarker(input.observacoes)

  await clientRes.client.request({
    method: 'POST',
    path: '/estoques',
    body,
  })
}

