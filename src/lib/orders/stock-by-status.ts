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

/**
 * Quantidade ainda a baixar para chegar em `desiredQty`, dado o líquido já saído.
 * Evita debitar de novo o que já saiu (ex.: qty aumentada após aprovação).
 */
export function remainingStockExitQuantity (desiredQty: number, netExitQty: number) {
  const desired = Math.max(0, Math.trunc(Number(desiredQty) || 0))
  const net = Math.max(0, Math.trunc(Number(netExitQty) || 0))
  if (desired <= 0 || net >= desired) return 0
  return desired - net
}

/**
 * Quantidade a devolver quando a saída líquida excede o desejado
 * (ex.: qty reduzida ou produto removido após aprovação).
 */
export function excessStockExitQuantity (desiredQty: number, netExitQty: number) {
  const desired = Math.max(0, Math.trunc(Number(desiredQty) || 0))
  const net = Math.max(0, Math.trunc(Number(netExitQty) || 0))
  if (net <= 0 || net <= desired) return 0
  return net - desired
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

/** Líquido de saída por produto já movimentado nesta OS. */
async function loadServiceOrderProductNetExits (
  supabase: SupabaseClient,
  orderId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('product_stock_movements')
    .select('product_id, type, quantity')
    .eq('source', 'service_order')
    .ilike('external_reference', `service_order:${orderId}:item:%`)

  if (error) throw error

  const nets = new Map<string, number>()
  for (const row of data ?? []) {
    const productId = String((row as { product_id?: string }).product_id || '').trim()
    if (!productId) continue
    const quantity = Math.abs(Number((row as { quantity?: number }).quantity) || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    const current = nets.get(productId) ?? 0
    if (row.type === 'exit') nets.set(productId, current + quantity)
    else if (row.type === 'entry') nets.set(productId, current - quantity)
  }
  return nets
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

async function resolveExitExternalReference (
  supabase: SupabaseClient,
  orderId: string,
  productId: string,
) {
  const baseRef = serviceOrderStockExitExternalReference(orderId, productId)
  const { data: baseExit } = await supabase
    .from('product_stock_movements')
    .select('id')
    .eq('product_id', productId)
    .eq('type', 'exit')
    .eq('source', 'service_order')
    .eq('external_reference', baseRef)
    .maybeSingle()

  // Reconsumo após devolução: a saída base já existe — usa ciclo novo.
  return baseExit?.id
    ? `${baseRef}:cycle:${Date.now()}`
    : baseRef
}

async function resolveReturnExternalReference (
  supabase: SupabaseClient,
  orderId: string,
  productId: string,
) {
  const baseReturn = serviceOrderStockReturnExternalReference(orderId, productId)
  const { data: existingReturn } = await supabase
    .from('product_stock_movements')
    .select('id')
    .eq('product_id', productId)
    .eq('type', 'entry')
    .eq('source', 'service_order')
    .eq('external_reference', baseReturn)
    .maybeSingle()

  return existingReturn?.id
    ? `${baseReturn}:${Date.now()}`
    : baseReturn
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

  // Baixa ao entrar na fase consumidora; reconciliamos qty enquanto permanece nela
  // (save sem mudança de status, aprovação → finalização, etc.).
  const enterConsuming = !hasConsumedPhase(previousStatus) && hasConsumedPhase(nextStatus)
  const reconcileWhileConsuming =
    hasConsumedPhase(previousStatus) && hasConsumedPhase(nextStatus)
  const returnOnFinalNoRepair = shouldReturnOnStatusTransition(previousStatus, nextStatus)
  if (!enterConsuming && !reconcileWhileConsuming && !returnOnFinalNoRepair) return

  const lines = getProductLines(input.services)
  const desiredByProduct = new Map(
    lines.map((line) => [line.productId, line] as const),
  )

  const existingNets = await loadServiceOrderProductNetExits(
    input.supabase,
    input.orderId,
  )

  const productIds = new Set<string>([
    ...desiredByProduct.keys(),
    ...existingNets.keys(),
  ])
  if (productIds.size === 0) return

  const { data: productRows } = await input.supabase
    .from('products')
    .select('id, bling_id')
    .in('id', [...productIds])

  type ProductIdRow = { id: string; bling_id: string | null }
  const blingByProductId = new Map<string, string>()
  for (const row of (productRows ?? []) as ProductIdRow[]) {
    const productId = String(row?.id || '').trim()
    const blingId = String(row?.bling_id || '').trim()
    if (!productId || !blingId) continue
    blingByProductId.set(productId, blingId)
  }

  // Cancelamento / final sem conserto: devolve todo o líquido saído.
  if (returnOnFinalNoRepair) {
    for (const productId of productIds) {
      const net = existingNets.get(productId)
        ?? await loadServiceOrderProductNetExit(input.supabase, input.orderId, productId)
      if (net <= 0) continue
      const line = desiredByProduct.get(productId)
      const unit = Math.max(0, Number(line?.unitCostCents) || 0)
      const ref = await resolveReturnExternalReference(
        input.supabase,
        input.orderId,
        productId,
      )
      await insertServiceOrderStockMovement({
        supabase: input.supabase,
        orderId: input.orderId,
        previousStatus,
        nextStatus,
        productId,
        type: 'entry',
        quantity: net,
        unitValueCents: unit,
        externalReference: ref,
        actorUserId: input.actorUserId,
        productBlingId: blingByProductId.get(productId),
      })
    }
    return
  }

  // Entrada na fase consumidora ou reconciliação (qty↑/qty↓/remoção).
  for (const productId of productIds) {
    const line = desiredByProduct.get(productId)
    const desired = Math.abs(Number(line?.quantity) || 0)
    const unit = Math.max(0, Number(line?.unitCostCents) || 0)
    const net = existingNets.get(productId)
      ?? await loadServiceOrderProductNetExit(input.supabase, input.orderId, productId)

    const exitQty = remainingStockExitQuantity(desired, net)
    if (exitQty > 0) {
      const ref = await resolveExitExternalReference(
        input.supabase,
        input.orderId,
        productId,
      )
      await insertServiceOrderStockMovement({
        supabase: input.supabase,
        orderId: input.orderId,
        previousStatus,
        nextStatus,
        productId,
        type: 'exit',
        quantity: exitQty,
        unitValueCents: unit,
        externalReference: ref,
        actorUserId: input.actorUserId,
        productBlingId: blingByProductId.get(productId),
      })
      continue
    }

    const returnQty = excessStockExitQuantity(desired, net)
    if (returnQty <= 0) continue

    const ref = await resolveReturnExternalReference(
      input.supabase,
      input.orderId,
      productId,
    )
    await insertServiceOrderStockMovement({
      supabase: input.supabase,
      orderId: input.orderId,
      previousStatus,
      nextStatus,
      productId,
      type: 'entry',
      quantity: returnQty,
      unitValueCents: unit,
      externalReference: ref,
      actorUserId: input.actorUserId,
      productBlingId: blingByProductId.get(productId),
    })
  }
}
