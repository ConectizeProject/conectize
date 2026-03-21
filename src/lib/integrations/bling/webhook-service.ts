import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, mapWebhookToLocalEffect } from '@/lib/integrations/bling/webhooks'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { blingProdutoApiPath, createBlingClientFromConnection } from '@/lib/integrations/bling/api'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'

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

/** Quem “cria” produto via webhook: staff/admin do tenant ou quem conectou o Bling. */
async function getCreatedByForProductWebhook (supabase: ServiceClient, actorUserId: string | null): Promise<string | null> {
  if (actorUserId) return actorUserId
  const { data: conn } = await supabase
    .from('hub_connections')
    .select('created_by')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const cb = (conn as { created_by?: string | null } | null)?.created_by
  return cb ? String(cb) : null
}

async function insertInitialStockFromBlingWebhook (
  supabase: ServiceClient,
  productId: string,
  quantity: number,
  unitCents: number,
  createdBy: string | null,
  externalReference: string,
): Promise<void> {
  if (!Number.isFinite(quantity) || quantity <= 0) return
  const row: Record<string, unknown> = {
    product_id: productId,
    type: 'entry',
    quantity: Math.round(quantity),
    unit_value_cents: unitCents,
    total_value_cents: Math.round(quantity) * unitCents,
    source: 'bling',
    external_reference: externalReference,
  }
  if (createdBy) row.created_by = createdBy
  const { error } = await supabase.from('product_stock_movements').insert(row)
  if (error) throw error
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

async function countProductsWithParentBlingId (
  supabase: ServiceClient,
  parentBlingId: string,
): Promise<number> {
  const key = String(parentBlingId || '').trim()
  if (!key) return 0
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('parent_bling_id', key)
  if (error) return 0
  return count ?? 0
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
      path: blingProdutoApiPath(blingId),
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
      const blingId = String(effect.blingId || '').trim()
      if (!blingId) {
        throw new Error('bling_product_id_missing')
      }

      const latest = await fetchBlingProductLatest(supabase, blingId)
      const payloadPartial =
        effect.payload && typeof effect.payload === 'object'
          ? (effect.payload as Record<string, unknown>)
          : {}
      const mergedDto: Record<string, unknown> = {
        id: blingId,
        ...(latest ?? {}),
        ...payloadPartial,
      }
      const local = mapBlingProductToLocal(mergedDto, blingId)
      const resolvedBlingId = local.blingId ? String(local.blingId) : blingId
      const name = String(local.name || '').trim()
      if (!name) {
        throw new Error('bling_product_fetch_or_name_missing')
      }

      const estoqueAtual =
        typeof local.estoqueAtual === 'number' && local.estoqueAtual >= 0 ? local.estoqueAtual : 0
      const unitCents = local.costPriceCents ?? 0

      const parentBlingKey = local.parentBlingId ? String(local.parentBlingId).trim() : ''
      const parentProductUuid = parentBlingKey
        ? await getProductIdByBlingId(supabase, parentBlingKey)
        : null

      const syncBase: Record<string, unknown> = {
        bling_id: resolvedBlingId,
        bling_sync_pending: false,
        bling_sync_snapshot: createProductSyncSnapshot(local),
        parent_bling_id: parentBlingKey || null,
        parent_product_id: parentProductUuid,
        name,
        sku: local.sku,
        barcode: local.barcode,
        description: local.description,
        image_url: local.imageUrl ?? null,
        sale_price_cents: local.salePriceCents,
        cost_price_cents: local.costPriceCents,
        is_active: local.isActive ?? true,
        kind: local.kind ?? null,
      }

      const { data: existingRow } = await supabase
        .from('products')
        .select(
          'id, parent_bling_id, parent_product_id, image_url, cost_price_cents, cost_price_manual_edited_at, bling_id',
        )
        .eq('bling_id', resolvedBlingId)
        .maybeSingle()

      type ExistingProductRow = {
        id?: string
        parent_bling_id?: string | null
        parent_product_id?: string | null
        image_url?: string | null
        cost_price_cents?: number | string | null
        cost_price_manual_edited_at?: string | null
        bling_id?: string | null
      }

      const existing = existingRow as ExistingProductRow | null
      const productId = existing?.id ? String(existing.id) : null

      if (productId) {
        const existingBlingKey = existing?.bling_id
          ? String(existing.bling_id).trim()
          : resolvedBlingId
        const variationRowsCount = await countProductsWithParentBlingId(
          supabase,
          existingBlingKey,
        )

        let parent_bling_id = (syncBase.parent_bling_id ?? null) as string | null
        let parent_product_id = (syncBase.parent_product_id ?? null) as string | null
        if (variationRowsCount > 0) {
          parent_bling_id = null
          parent_product_id = null
        } else {
          const hadParentInPortal =
            existing?.parent_bling_id != null &&
            String(existing.parent_bling_id).trim() !== ''
          const incomingParentEmpty =
            !parent_bling_id || String(parent_bling_id).trim() === ''
          if (hadParentInPortal && incomingParentEmpty && existing.parent_bling_id) {
            parent_bling_id = String(existing.parent_bling_id).trim()
            parent_product_id = existing.parent_product_id
              ? String(existing.parent_product_id)
              : await getProductIdByBlingId(supabase, parent_bling_id)
          }
          /**
           * Portal listou como produto raiz (`parent_bling_id` null). Após PATCH no Bling (ex.: GTIN),
           * o GET/webhook pode trazer `produtoPai` ou nós aninhados e o mapper infere pai — o registro
           * vira “variação” e some da query de pais (paginação). Só confiar em pai vindo do Bling
           * quando o portal já tinha vínculo ou em sincronização explícita (“Atualizar pelo Bling”).
           */
          const incomingHasParent =
            parent_bling_id != null && String(parent_bling_id).trim() !== ''
          if (!hadParentInPortal && incomingHasParent) {
            parent_bling_id = null
            parent_product_id = null
          }
        }

        let image_url = syncBase.image_url as string | null | undefined
        if (image_url != null) image_url = String(image_url).trim() || null
        else image_url = null

        const existingImg =
          existing?.image_url != null ? String(existing.image_url).trim() : ''
        if ((!image_url || image_url === '') && existingImg) {
          image_url = existingImg
        }

        let cost_price_cents = syncBase.cost_price_cents as number | null | undefined
        if (existing?.cost_price_manual_edited_at) {
          const keep = existing.cost_price_cents
          if (keep != null && keep !== '') {
            const n =
              typeof keep === 'number' ? keep : Number(String(keep).replace(',', '.'))
            cost_price_cents = Number.isFinite(n) ? Math.round(n) : null
          } else {
            cost_price_cents = null
          }
        }

        const updatePayload: Record<string, unknown> = {
          ...syncBase,
          parent_bling_id,
          parent_product_id,
          image_url,
          cost_price_cents,
          updated_at: new Date().toISOString(),
        }
        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', productId)

        if (updateError) throw updateError
      } else {
        const createdBy = await getCreatedByForProductWebhook(supabase, actorUserId)
        const insertPayload: Record<string, unknown> = {
          ...syncBase,
          created_by: createdBy,
        }
        const { data: inserted, error: insertError } = await supabase
          .from('products')
          .insert(insertPayload)
          .select('id')
          .single()

        if (insertError) throw insertError
        const newId = inserted && typeof (inserted as { id?: string }).id === 'string'
          ? (inserted as { id: string }).id
          : null
        if (newId && estoqueAtual > 0) {
          await insertInitialStockFromBlingWebhook(
            supabase,
            newId,
            estoqueAtual,
            unitCents,
            actorUserId,
            `bling:webhook:${id}:product_initial_stock`,
          )
        }
      }
    }

    if (effect.action === 'deactivateProductByBlingId') {
      const blingId = String(effect.blingId || '').trim()
      if (!blingId) {
        throw new Error('bling_product_id_missing')
      }
      const productUuid = await getProductIdByBlingId(supabase, blingId)
      if (productUuid) {
        const { error: deactivateErr } = await supabase
          .from('products')
          .update({
            is_active: false,
            bling_sync_pending: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productUuid)
        if (deactivateErr) throw deactivateErr
      }
    }

    if (effect.action === 'updateProductSupplierCost') {
      const blingId = String(effect.blingProductId || '').trim()
      if (!blingId) {
        throw new Error('bling_product_id_missing')
      }
      const productUuid = await getProductIdByBlingId(supabase, blingId)
      if (productUuid) {
        const { data: costRow } = await supabase
          .from('products')
          .select('cost_price_manual_edited_at')
          .eq('id', productUuid)
          .maybeSingle()
        const manual = (costRow as { cost_price_manual_edited_at?: string | null } | null)
          ?.cost_price_manual_edited_at
        if (!manual) {
          const { error: costUpErr } = await supabase
            .from('products')
            .update({
              cost_price_cents: effect.costPriceCents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', productUuid)
          if (costUpErr) throw costUpErr
        }
      }
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
