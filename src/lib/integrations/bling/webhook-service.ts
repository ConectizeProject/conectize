import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBlingWebhook, mapWebhookToLocalEffect } from '@/lib/integrations/bling/webhooks'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'

const PLATFORM_ID = 'bling'

async function getSystemUserId (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

async function getProductIdByBlingId (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, blingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('bling_id', blingId)
    .limit(1)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

async function getProductCurrentStockLocal (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, productId: string): Promise<number> {
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

export async function processBlingWebhook (id: string): Promise<{ ok: true; status: 'processed' } | { ok: false; status: 'error'; error_message: string }> {
  const supabase = await createSupabaseServerClient()

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

  const systemUserId = await getSystemUserId(supabase)

  try {
    if (effect.action === 'updateProduct') {
      const productId = await getProductIdByBlingId(supabase, effect.blingId)
      if (!productId) {
        throw new Error('product_not_found')
      }
      const local = mapBlingProductToLocal(effect.payload)
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (local.name) updatePayload.name = local.name
      if (local.sku !== undefined) updatePayload.sku = local.sku
      if (local.barcode !== undefined) updatePayload.barcode = local.barcode
      if (local.description !== undefined) updatePayload.description = local.description
      if (typeof local.salePriceCents === 'number') updatePayload.sale_price_cents = local.salePriceCents
      if (typeof local.costPriceCents === 'number') updatePayload.cost_price_cents = local.costPriceCents
      if (typeof local.isActive === 'boolean') updatePayload.is_active = local.isActive

      const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', productId)

      if (updateError) throw updateError
    }

    if (effect.action === 'syncStock') {
      const productId = await getProductIdByBlingId(supabase, effect.blingId)
      if (!productId) {
        throw new Error('product_not_found')
      }
      const currentStock = await getProductCurrentStockLocal(supabase, productId)
      const diff = effect.estoqueAtual - currentStock
      if (diff !== 0 && systemUserId) {
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
            created_by: systemUserId,
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
  const supabase = await createSupabaseServerClient()
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
