import { pushStockMovementToBling } from '@/lib/integrations/bling/push-stock-movement'

type OrderServiceItem = {
  kind?: 'service' | 'product' | null
  description?: string | null
  quantity?: number | null
  unitCostCents?: number | null
  sourceProductId?: string | null
}

const FINAL_STATUSES = new Set([
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
  'cancelada',
])

const STOCK_CONSUMING_STATUSES = new Set([
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
])

function normalizeServices (services: unknown): OrderServiceItem[] {
  if (!Array.isArray(services)) return []
  return services
    .map((item) => item && typeof item === 'object' ? item as OrderServiceItem : null)
    .filter((item): item is OrderServiceItem => Boolean(item))
}

function shouldConsumeStock (status: string) {
  if (!status) return false
  if (status === 'orcamento') return false
  if (FINAL_STATUSES.has(status)) return false
  return STOCK_CONSUMING_STATUSES.has(status)
}

function shouldReturnStockOnFinalWithoutRepair (nextStatus: string) {
  return nextStatus === 'cancelada'
    || nextStatus === 'finalizada_sem_conserto'
    || nextStatus === 'finalizada_sem_aprovacao'
}

function shouldReturnOnStatusTransition (previousStatus: string, nextStatus: string) {
  return shouldReturnStockOnFinalWithoutRepair(nextStatus) && shouldConsumeStock(previousStatus)
}

function getProductLines (services: unknown) {
  const items = normalizeServices(services)
  const lines = new Map<string, { quantity: number, unitCostCents: number, description: string }>()

  for (const item of items) {
    if (item.kind !== 'product') continue
    const productId = String(item.sourceProductId || '').trim()
    if (!productId) continue
    const qty = Math.max(0, Number(item.quantity) || 0)
    if (!Number.isFinite(qty) || qty <= 0) continue
    const unitCostCents = Math.max(0, Number(item.unitCostCents) || 0)
    const description = String(item.description || '').trim().slice(0, 80)
    const current = lines.get(productId)
    if (!current) {
      lines.set(productId, { quantity: qty, unitCostCents, description })
      continue
    }
    current.quantity += qty
    if (current.unitCostCents <= 0 && unitCostCents > 0) {
      current.unitCostCents = unitCostCents
    }
  }

  return Array.from(lines.entries()).map(([productId, values]) => ({
    productId,
    quantity: values.quantity,
    unitCostCents: values.unitCostCents,
    description: values.description,
  }))
}

type ApplyOrderStatusStockTransitionInput = {
  supabase: any
  orderId: string
  previousStatus: string
  nextStatus: string
  services: unknown
  actorUserId?: string | null
}

export async function applyOrderStatusStockTransition (input: ApplyOrderStatusStockTransitionInput): Promise<void> {
  const previousStatus = String(input.previousStatus || '').trim()
  const nextStatus = String(input.nextStatus || '').trim()

  const enterConsuming = !shouldConsumeStock(previousStatus) && shouldConsumeStock(nextStatus)
  const returnOnFinalNoRepair = shouldReturnOnStatusTransition(previousStatus, nextStatus)
  if (!enterConsuming && !returnOnFinalNoRepair) return

  const lines = getProductLines(input.services)
  if (lines.length === 0) return

  const type = enterConsuming ? 'exit' : 'entry'
  const productIds = lines.map((line) => line.productId)
  const { data: productRows } = await input.supabase
    .from('products')
    .select('id, bling_id')
    .in('id', productIds)

  const blingByProductId = new Map<string, string>()
  for (const row of productRows ?? []) {
    const productId = String((row as any)?.id || '').trim()
    const blingId = String((row as any)?.bling_id || '').trim()
    if (!productId || !blingId) continue
    blingByProductId.set(productId, blingId)
  }

  for (const line of lines) {
    const quantity = Math.abs(Number(line.quantity) || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const unit = Math.max(0, Number(line.unitCostCents) || 0)
    const ref = `os:${input.orderId}:status:${previousStatus}->${nextStatus}:${line.productId}`
    const payload: Record<string, unknown> = {
      product_id: line.productId,
      type,
      quantity,
      unit_value_cents: unit,
      total_value_cents: quantity * unit,
      source: 'system',
      external_reference: ref,
    }
    if (input.actorUserId) payload.created_by = input.actorUserId

    const { error } = await input.supabase
      .from('product_stock_movements')
      .insert(payload)

    if (error) throw error

    const productBlingId = blingByProductId.get(line.productId)
    if (!productBlingId) continue

    try {
      await pushStockMovementToBling({
        productBlingId,
        type,
        quantity,
        unitValueCents: unit,
        observacoes: `OS ${input.orderId}: ${previousStatus} -> ${nextStatus}`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'unknown_error'
      console.error('[order-stock-transition][bling-push-failed]', {
        orderId: input.orderId,
        previousStatus,
        nextStatus,
        productId: line.productId,
        productBlingId,
        movementType: type,
        quantity,
        unitValueCents: unit,
        error: errorMessage,
      })
    }
  }
}

