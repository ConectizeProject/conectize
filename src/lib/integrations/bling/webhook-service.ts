import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, mapWebhookToLocalEffect } from '@/lib/integrations/bling/webhooks'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { createBlingClientFromConnection } from '@/lib/integrations/bling/api'

const PLATFORM_ID = 'bling'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>
type HubConnectionRow = {
  id: string
  platform_id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  metadata: Record<string, unknown> | null
  created_by: string | null
}

/** Usuário “ator” para created_by em movimentos gerados por webhook (admin ou staff). */
async function getWebhookActorUserId (supabase: ServiceClient): Promise<string | null> {
  const { data: admin } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (admin?.id) return String(admin.id)
  const { data: staff } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'staff')
    .limit(1)
    .maybeSingle()
  return staff?.id ? String(staff.id) : null
}

async function getProductIdByBlingId (supabase: ServiceClient, blingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('bling_id', blingId)
    .limit(1)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

async function getProductCurrentStockLocal (supabase: ServiceClient, productId: string): Promise<number> {
  const { data } = await supabase
    .from('product_stock_movements')
    .select('type, quantity')
    .eq('product_id', productId)
  if (!data || !Array.isArray(data)) return 0
  let balance = 0
  for (const row of data) {
    const type = (row as { type: string }).type
    const q = Number((row as { quantity: number }).quantity) || 0
    if (type === 'entry') balance += q
    else if (type === 'exit' || type === 'loss') balance -= q
  }
  return balance
}

async function fetchBlingProductLatest (supabase: ServiceClient, blingId: string): Promise<Record<string, unknown> | null> {
  const { data: conn } = await supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  try {
    const client = await createBlingClientFromConnection(conn as HubConnectionRow)
    const response = await client.request<{ data?: Record<string, unknown> }>({
      method: 'GET',
      path: `/produtos/${blingId}`,
    })
    const data = response?.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    return data
  } catch {
    return null
  }
}

export async function processBlingWebhook (id: string): Promise<{ ok: true; status: 'processed' } | { ok: false; status: 'error'; error_message: string }> {
  const supabase = createSupabaseServiceClient()

  const { data: row, error: fetchError } = await supabase
    .from('integration_webhooks')
    .select('id, platform_id, payload, retry_count')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !row || (row as { platform_id: string }).platform_id !== PLATFORM_ID) {
    const msg = fetchError?.message || 'webhook_not_found'
    await supabase
      .from('integration_webhooks')
      .update({
        status: 'error',
        error_message: msg,
        processed_at: new Date().toISOString(),
        retry_count: ((row as { retry_count?: number })?.retry_count ?? 0) + 1,
      })
      .eq('id', id)
    return { ok: false, status: 'error', error_message: msg }
  }

  const payload = (row as { payload: unknown }).payload
  const parsed = parseBlingWebhook(payload)
  const effect = mapWebhookToLocalEffect(parsed)
  const retryCount = ((row as { retry_count?: number }).retry_count ?? 0) + 1

  if (effect.action === 'skip') {
    await supabase
      .from('integration_webhooks')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        retry_count: retryCount,
        error_message: null,
      })
      .eq('id', id)
    return { ok: true, status: 'processed' }
  }

  const actorUserId = await getWebhookActorUserId(supabase)

  try {
    if (effect.action === 'updateProduct') {
      const productId = await getProductIdByBlingId(supabase, effect.blingId)
      if (!productId) {
        throw new Error('product_not_found')
      }
      const latest = await fetchBlingProductLatest(supabase, effect.blingId)
      const local = mapBlingProductToLocal((latest ?? effect.payload) as Record<string, unknown>)
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (local.name) updatePayload.name = local.name
      if (local.sku !== undefined) updatePayload.sku = local.sku
      if (local.barcode !== undefined) updatePayload.barcode = local.barcode
      if (local.description !== undefined) updatePayload.description = local.description
      if (local.kind === 'product' || local.kind === 'service') updatePayload.kind = local.kind
      if (typeof local.salePriceCents === 'number') updatePayload.sale_price_cents = local.salePriceCents
      if (typeof local.costPriceCents === 'number') updatePayload.cost_price_cents = local.costPriceCents
      if (typeof local.isActive === 'boolean') updatePayload.is_active = local.isActive

      const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', productId)

      if (updateError) throw updateError
    }

    if (effect.action === 'insertStockMovementFromBling') {
      const productId = await getProductIdByBlingId(supabase, effect.blingId)
      if (!productId) {
        throw new Error('product_not_found')
      }

      const { data: existingMov } = await supabase
        .from('product_stock_movements')
        .select('id')
        .eq('external_reference', effect.externalReference)
        .limit(1)
        .maybeSingle()

      if (existingMov?.id) {
        // Idempotente: mesmo eventId do Bling já foi aplicado
      } else {
        const currentLocal = await getProductCurrentStockLocal(supabase, productId)
        let diff: number
        if (effect.targetVirtualStock != null) {
          // Alinha com o saldo virtual informado pelo Bling (total ou depósito)
          diff = effect.targetVirtualStock - currentLocal
        } else {
          // Sem saldo virtual no payload: aplica só o delta E/S + quantidade
          diff = effect.blingOperacao === 'E'
            ? effect.blingQuantidade
            : -effect.blingQuantidade
        }

        if (diff === 0) {
          // Já bate com o virtual do Bling; nada a lançar
        } else {
          const movementType = diff > 0 ? 'entry' : 'exit'
          const qty = Math.abs(diff)
          const { data: prod } = await supabase
            .from('products')
            .select('cost_price_cents, sale_price_cents')
            .eq('id', productId)
            .maybeSingle()
          const unitCents = (prod as { cost_price_cents?: number })?.cost_price_cents
            ?? (prod as { sale_price_cents?: number })?.sale_price_cents
            ?? 0
          const insertRow: Record<string, unknown> = {
            product_id: productId,
            type: movementType,
            quantity: qty,
            unit_value_cents: unitCents,
            total_value_cents: qty * unitCents,
            source: 'bling',
            external_reference: effect.externalReference,
          }
          if (actorUserId) insertRow.created_by = actorUserId
          if (effect.occurredAtIso) {
            const parsedDate = new Date(effect.occurredAtIso)
            if (!Number.isNaN(parsedDate.getTime())) {
              insertRow.created_at = parsedDate.toISOString()
            }
          }
          const { error: movError } = await supabase
            .from('product_stock_movements')
            .insert(insertRow)
          if (movError) throw movError
        }
      }
    }

    if (effect.action === 'syncStock') {
      const productId = await getProductIdByBlingId(supabase, effect.blingId)
      if (!productId) {
        throw new Error('product_not_found')
      }
      const currentStock = await getProductCurrentStockLocal(supabase, productId)
      const diff = effect.estoqueAtual - currentStock
      if (diff !== 0 && actorUserId) {
        const { data: prod } = await supabase
          .from('products')
          .select('cost_price_cents, sale_price_cents')
          .eq('id', productId)
          .maybeSingle()
        const unitCents = (prod as { cost_price_cents?: number })?.cost_price_cents ?? (prod as { sale_price_cents?: number })?.sale_price_cents ?? 0
        const { error: movError } = await supabase
          .from('product_stock_movements')
          .insert({
            product_id: productId,
            type: diff > 0 ? 'entry' : 'exit',
            quantity: Math.abs(diff),
            unit_value_cents: unitCents,
            total_value_cents: Math.abs(diff) * unitCents,
            source: 'bling',
            external_reference: `webhook_${id}`,
            created_by: actorUserId,
          })
        if (movError) throw movError
      }
    }

    await supabase
      .from('integration_webhooks')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        retry_count: retryCount,
        error_message: null,
      })
      .eq('id', id)

    return { ok: true, status: 'processed' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('integration_webhooks')
      .update({
        status: 'error',
        error_message: message,
        processed_at: new Date().toISOString(),
        retry_count: retryCount,
      })
      .eq('id', id)
    return { ok: false, status: 'error', error_message: message }
  }
}

export async function processPendingBlingWebhooks (limit: number): Promise<number> {
  const supabase = createSupabaseServiceClient()
  const { data: rows } = await supabase
    .from('integration_webhooks')
    .select('id')
    .eq('platform_id', PLATFORM_ID)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(Math.min(limit, 50))

  if (!rows || rows.length === 0) return 0
  let processed = 0
  for (const r of rows) {
    await processBlingWebhook(String((r as { id: string }).id))
    processed += 1
  }
  return processed
}
