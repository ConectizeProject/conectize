import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import type { StockMovementType } from '@/lib/products/service'

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
  const productIdNum = Number(String(input.productBlingId).trim())
  if (!Number.isFinite(productIdNum) || productIdNum <= 0) {
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
  if (input.observacoes) body.observacoes = input.observacoes

  await clientRes.client.request({
    method: 'POST',
    path: '/estoques',
    body,
  })
}

