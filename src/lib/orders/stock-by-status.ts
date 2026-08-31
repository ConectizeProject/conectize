import type { SupabaseClient } from '@supabase/supabase-js'
import { pushStockMovementToBling } from '@/lib/integrations/bling/push-stock-movement'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type OrderServiceItem = {
  kind?: 'service' | 'product' | null
  description?: string | null
  quantity?: number | null
  unitCostCents?: number | null
  sourceProductId?: string | null
}

function normalizeServices (services: unknown): OrderServiceItem[] {
  if (!Array.isArray(services)) return []
  return services
    .map((item) => item && typeof item === 'object' ? item as OrderServiceItem : null)
    .filter((item): item is OrderServiceItem => Boolean(item))
}

const STOCK_CONSUMED_STATUS_SET = new Set<string>([
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
  'finalizada',
])

function hasConsumedPhase (status: string) {
  if (!status) return false
  return STOCK_CONSUMED_STATUS_SET.has(status)
}

function shouldReturnStockOnFinalWithoutRepair (nextStatus: string) {
  return nextStatus === 'cancelada'
    || nextStatus === 'finalizada_sem_conserto'
    || nextStatus === 'finalizada_sem_aprovacao'
}

function shouldReturnOnStatusTransition (previousStatus: string, nextStatus: string) {
  return shouldReturnStockOnFinalWithoutRepair(nextStatus) && hasConsumedPhase(previousStatus)
}

/** Saída base 1-1 por produto na OS. */
export function serviceOrderStockExitExternalReference (orderId: string, productId: string) {
  return `service_order:${orderId}:item:${productId}`
}

/** Devolução após cancelamento / final sem conserto (não colide com a saída base). */
export function serviceOrderStockReturnExternalReference (orderId: string, productId: string) {
  return `service_order:${orderId}:item:${productId}:return`
}

function getProductLines (services: unknown) {
  const items = normalizeServices(services)
  const lines = new Map<string, { quantity: number, unitCostCents: number, description: string }>()

  for (const item of items) {
    if (item.kind !== 'product') continue
    const productId = parseOptionalUuid(item.sourceProductId)
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

async function loadServiceOrderProductNetExit (
  supabase: SupabaseClient,
  orderId: string,
  productId: string,
) {
  const { data, error } = await supabase
    .from('product_stock_movements')
    .select('type, quantity')
    .eq('product_id', productId)
    .eq('source', 'service_order')
    .ilike('external_reference', `service_order:${orderId}:item:${productId}%`)

  if (error) throw error

  let net = 0
  for (const row of data ?? []) {
    const quantity = Math.abs(Number(row.quantity) || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (row.type === 'exit') net += quantity
    else if (row.type === 'entry') net -= quantity
  }
  return net
}

async function insertServiceOrderStockMovement (input: {
  supabase: SupabaseClient
  orderId: string
  previousStatus: string
  nextStatus: string
  productId: string
  type: 'exit' | 'entry'
  quantity: number
  unitValueCents: number
  externalReference: string
  actorUserId?: string | null
  productBlingId?: string
}) {
  const payload: Record<string, unknown> = {
    product_id: input.productId,
    type: input.type,
    quantity: input.quantity,
    unit_value_cents: input.unitValueCents,
    total_value_cents: input.quantity * input.unitValueCents,
    source: 'service_order',
    external_reference: input.externalReference,
  }
  if (input.actorUserId) payload.created_by = input.actorUserId

  const { error } = await input.supabase
    .from('product_stock_movements')
    .insert(payload)

  if (error) {
    // Unique index: corrida/retry já criou o movimento.
    if (String(error.code || '') === '23505') return
    throw error
  }

  if (!input.productBlingId) return

  try {
    await pushStockMovementToBling({
      productBlingId: input.productBlingId,
      type: input.type,
      quantity: input.quantity,
      unitValueCents: input.unitValueCents,
      observacoes: `OS ${input.orderId}: ${input.previousStatus} -> ${input.nextStatus}`,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown_error'
    console.error('[order-stock-transition][bling-push-failed]', {
      orderId: input.orderId,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      productId: input.productId,
      productBlingId: input.productBlingId,
      movementType: input.type,
      quantity: input.quantity,
      unitValueCents: input.unitValueCents,
      error: errorMessage,
    })
  }
}

type ApplyOrderStatusStockTransitionInput = {
  supabase: SupabaseClient
  orderId: string
  previousStatus: string
  nextStatus: string
  services: unknown
  actorUserId?: string | null
}

export async function applyOrderStatusStockTransition (input: ApplyOrderStatusStockTransitionInput): Promise<void> {
  const previousStatus = String(input.previousStatus || '').trim()
  const nextStatus = String(input.nextStatus || '').trim()

  // Baixa acontece quando entra na fase consumidora (ex.: aprovado),
  // e ao finalizar garantimos a baixa caso tenha faltado em uma etapa anterior.
  const enterConsuming = !hasConsumedPhase(previousStatus) && hasConsumedPhase(nextStatus)
  const ensureConsumeOnFinalize = nextStatus === 'finalizada'
  const returnOnFinalNoRepair = shouldReturnOnStatusTransition(previousStatus, nextStatus)
  if (!enterConsuming && !returnOnFinalNoRepair && !ensureConsumeOnFinalize) return

  const lines = getProductLines(input.services)
  if (lines.length === 0) return

  const type = (enterConsuming || ensureConsumeOnFinalize) ? 'exit' : 'entry'
  const productIds = lines.map((line) => line.productId)
  const { data: productRows } = await input.supabase
    .from('products')
    .select('id, bling_id')
    .in('id', productIds)

  type ProductIdRow = { id: string; bling_id: string | null }
  const blingByProductId = new Map<string, string>()
  for (const row of (productRows ?? []) as ProductIdRow[]) {
    const productId = String(row?.id || '').trim()
    const blingId = String(row?.bling_id || '').trim()
    if (!productId || !blingId) continue
    blingByProductId.set(productId, blingId)
  }

  for (const line of lines) {
    const quantity = Math.abs(Number(line.quantity) || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const unit = Math.max(0, Number(line.unitCostCents) || 0)
    const net = await loadServiceOrderProductNetExit(
      input.supabase,
      input.orderId,
      line.productId,
    )

    let ref: string
    let moveQty = quantity

    if (type === 'exit') {
      // Já há saída líquida suficiente (retry / finalize após aprovado).
      if (net >= quantity) continue

      const baseRef = serviceOrderStockExitExternalReference(input.orderId, line.productId)
      const { data: baseExit } = await input.supabase
        .from('product_stock_movements')
        .select('id')
        .eq('product_id', line.productId)
        .eq('type', 'exit')
        .eq('source', 'service_order')
        .eq('external_reference', baseRef)
        .maybeSingle()

      // Reconsumo após devolução: a saída base já existe — usa ciclo novo.
      ref = baseExit?.id
        ? `${baseRef}:cycle:${Date.now()}`
        : baseRef
    } else {
      if (net <= 0) continue
      moveQty = Math.min(quantity, net)
      const baseReturn = serviceOrderStockReturnExternalReference(
        input.orderId,
        line.productId,
      )
      const { data: existingReturn } = await input.supabase
        .from('product_stock_movements')
        .select('id')
        .eq('product_id', line.productId)
        .eq('type', 'entry')
        .eq('source', 'service_order')
        .eq('external_reference', baseReturn)
        .maybeSingle()

      ref = existingReturn?.id
        ? `${baseReturn}:${Date.now()}`
        : baseReturn
    }

    await insertServiceOrderStockMovement({
      supabase: input.supabase,
      orderId: input.orderId,
      previousStatus,
      nextStatus,
      productId: line.productId,
      type,
      quantity: moveQty,
      unitValueCents: unit,
      externalReference: ref,
      actorUserId: input.actorUserId,
      productBlingId: blingByProductId.get(line.productId),
    })
  }
}
