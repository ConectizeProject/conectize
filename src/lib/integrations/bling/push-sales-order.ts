import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getBlingClientForCurrentUser,
  normalizeBlingProductId,
} from '@/lib/integrations/bling/api'
import {
  blingNfceUrl,
  blingOrderPreferredUrl,
  blingPedidoVendaUrl,
} from '@/lib/integrations/bling/bling-urls'

type AuthCtx = {
  organizationId: string
  userId: string
  supabase: SupabaseClient
}

export type PushSalesOrderToBlingResult =
  | {
    ok: true
    blingPedidoId: string
    blingNfceId: string | null
    pedidoUrl: string
    nfceUrl: string | null
    preferredUrl: string
    alreadySynced: boolean
    nfceGenerated: boolean
    nfceError: string | null
  }
  | {
    ok: false
    error: string
    message: string
  }

type BlingContactRow = {
  id?: number
  nome?: string
}

type BlingCreateResponse = {
  data?: { id?: number | string }
}

function centsToBlingMoney (cents: number) {
  return Math.round(cents) / 100
}

function extractCreatedId (data: unknown): string | null {
  const id = (data as BlingCreateResponse | null)?.data?.id
  if (id == null) return null
  const s = String(id).trim()
  return s || null
}

function humanizeBlingPushError (error: string) {
  const e = String(error || '').trim()
  if (e === 'bling_not_connected' || e === 'not_authenticated') {
    return 'Conecte o Bling no HUB antes de enviar o pedido.'
  }
  if (e === 'order_not_found') return 'Pedido não encontrado.'
  if (e === 'order_not_paid') return 'Só é possível enviar pedidos pagos ao Bling.'
  if (e === 'order_canceled') return 'Pedido cancelado não pode ser enviado ao Bling.'
  if (e === 'no_items') return 'Pedido sem itens.'
  if (e === 'products_missing_bling_id') {
    return 'Um ou mais produtos não têm ID Bling. Vincule os produtos no catálogo e tente de novo.'
  }
  if (e === 'consumidor_final_not_resolved') {
    return 'Não foi possível obter o contato Consumidor Final no Bling.'
  }
  if (e === 'bling_pedido_create_failed') {
    return 'O Bling não retornou o ID do pedido criado.'
  }
  if (e.startsWith('db_')) return 'Erro ao salvar o vínculo com o Bling.'
  return e || 'Não foi possível enviar o pedido ao Bling.'
}

async function resolveConsumidorFinalContactId (
  client: { request: <T = unknown>(options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, string | number | boolean | undefined | null>
    body?: unknown
  }) => Promise<T> }
): Promise<number> {
  const list = await client.request<{ data?: BlingContactRow[] }>({
    method: 'GET',
    path: '/contatos',
    query: {
      pesquisa: 'Consumidor Final',
      limite: 50,
    },
  })

  const rows = Array.isArray(list?.data) ? list.data : []
  const exact = rows.find((row) => {
    const nome = String(row.nome || '').trim().toLowerCase()
    return nome === 'consumidor final' && typeof row.id === 'number' && row.id > 0
  })
  if (exact?.id) return exact.id

  const fuzzy = rows.find((row) => {
    const nome = String(row.nome || '').trim().toLowerCase()
    return nome.includes('consumidor final') && typeof row.id === 'number' && row.id > 0
  })
  if (fuzzy?.id) return fuzzy.id

  const created = await client.request<BlingCreateResponse>({
    method: 'POST',
    path: '/contatos',
    body: {
      nome: 'Consumidor Final',
      tipo: 'F',
      situacao: 'A',
    },
  })

  const id = Number(extractCreatedId(created))
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('consumidor_final_not_resolved')
  }
  return id
}

async function tryGenerateNfce (
  client: { request: <T = unknown>(options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, string | number | boolean | undefined | null>
    body?: unknown
  }) => Promise<T> },
  blingPedidoId: string
): Promise<{ nfceId: string | null, error: string | null }> {
  try {
    const res = await client.request<BlingCreateResponse>({
      method: 'POST',
      path: `/pedidos/vendas/${encodeURIComponent(blingPedidoId)}/gerar-nfce`,
      body: {},
    })
    const nfceId = extractCreatedId(res)
    if (!nfceId) {
      return { nfceId: null, error: 'bling_nfce_create_empty_id' }
    }
    return { nfceId, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bling_nfce_generate_failed'
    return { nfceId: null, error: message }
  }
}

/**
 * Cria o pedido de venda no Bling (Consumidor Final), tenta gerar NFC-e
 * e persiste o vínculo em `sales_orders`. Não lança estoque/contas no Bling
 * (estoque já foi baixado no Conectize na finalização).
 */
export async function pushSalesOrderToBling (
  auth: AuthCtx,
  orderId: string
): Promise<PushSalesOrderToBlingResult> {
  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, total_cents, discount_total_cents, bling_pedido_id, bling_nfce_id, created_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    return { ok: false, error: 'db_error', message: humanizeBlingPushError('db_error') }
  }
  if (!order) {
    return { ok: false, error: 'order_not_found', message: humanizeBlingPushError('order_not_found') }
  }
  if (order.status === 'canceled') {
    return { ok: false, error: 'order_canceled', message: humanizeBlingPushError('order_canceled') }
  }
  if (order.status !== 'paid') {
    return { ok: false, error: 'order_not_paid', message: humanizeBlingPushError('order_not_paid') }
  }

  if (order.bling_pedido_id) {
    const pedidoUrl = blingPedidoVendaUrl(order.bling_pedido_id)
    const nfceUrl = order.bling_nfce_id ? blingNfceUrl(order.bling_nfce_id) : null
    const preferredUrl = blingOrderPreferredUrl({
      blingPedidoId: order.bling_pedido_id,
      blingNfceId: order.bling_nfce_id,
    }) || pedidoUrl
    return {
      ok: true,
      blingPedidoId: String(order.bling_pedido_id),
      blingNfceId: order.bling_nfce_id ? String(order.bling_nfce_id) : null,
      pedidoUrl,
      nfceUrl,
      preferredUrl,
      alreadySynced: true,
      nfceGenerated: Boolean(order.bling_nfce_id),
      nfceError: null,
    }
  }

  const { data: items, error: itemsError } = await auth.supabase
    .from('sales_order_items')
    .select('id, product_id, quantity, unit_price_cents, discount_cents, products(id, name, bling_id)')
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)
    .order('created_at', { ascending: true })

  if (itemsError) {
    return { ok: false, error: 'db_error', message: humanizeBlingPushError('db_error') }
  }
  if (!items || items.length === 0) {
    return { ok: false, error: 'no_items', message: humanizeBlingPushError('no_items') }
  }

  const blingItems: Array<{
    produto: { id: number }
    quantidade: number
    valor: number
    desconto: number
    descricao?: string
  }> = []

  for (const item of items) {
    const productRaw = item.products
    const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as {
      id?: string
      name?: string | null
      bling_id?: string | null
    } | null

    const blingIdStr = normalizeBlingProductId(product?.bling_id)
    const blingIdNum = Number(blingIdStr)
    if (!blingIdStr || !Number.isFinite(blingIdNum) || blingIdNum <= 0) {
      return {
        ok: false,
        error: 'products_missing_bling_id',
        message: humanizeBlingPushError('products_missing_bling_id'),
      }
    }

    blingItems.push({
      produto: { id: blingIdNum },
      quantidade: Math.max(1, Number(item.quantity) || 1),
      valor: centsToBlingMoney(Number(item.unit_price_cents) || 0),
      desconto: centsToBlingMoney(Number(item.discount_cents) || 0),
      descricao: String(product?.name || '').trim() || undefined,
    })
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_not_connected'
    return { ok: false, error, message: humanizeBlingPushError(error) }
  }

  const { client } = clientRes

  let contatoId: number
  try {
    contatoId = await resolveConsumidorFinalContactId(client)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'consumidor_final_not_resolved'
    return {
      ok: false,
      error: message,
      message: humanizeBlingPushError(message),
    }
  }

  const orderDate = new Date(order.created_at || Date.now())
  const dataIso = Number.isNaN(orderDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : orderDate.toISOString().slice(0, 10)

  const descontoTotal = centsToBlingMoney(Number(order.discount_total_cents) || 0)

  let createdPedidoId: string
  try {
    const body: Record<string, unknown> = {
      contato: { id: contatoId },
      data: dataIso,
      numeroPedidoCompra: String(order.order_number ?? ''),
      observacoes: `Pedido Conectize #${order.order_number ?? ''}`.trim(),
      observacoesInternas: `sales_order_id=${order.id}`,
      itens: blingItems,
    }
    if (descontoTotal > 0) {
      body.desconto = { valor: descontoTotal, unidade: 'REAL' }
    }

    const created = await client.request<BlingCreateResponse>({
      method: 'POST',
      path: '/pedidos/vendas',
      body,
    })
    const id = extractCreatedId(created)
    if (!id) {
      return {
        ok: false,
        error: 'bling_pedido_create_failed',
        message: humanizeBlingPushError('bling_pedido_create_failed'),
      }
    }
    createdPedidoId = id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bling_pedido_create_failed'
    await auth.supabase
      .from('sales_orders')
      .update({
        bling_last_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', auth.organizationId)
      .eq('id', orderId)

    return {
      ok: false,
      error: 'bling_pedido_create_failed',
      message: humanizeBlingPushError(message) === message
        ? `Falha ao criar pedido no Bling: ${message}`
        : humanizeBlingPushError(message),
    }
  }

  const nfceAttempt = await tryGenerateNfce(client, createdPedidoId)

  const { error: updateError } = await auth.supabase
    .from('sales_orders')
    .update({
      bling_pedido_id: createdPedidoId,
      bling_nfce_id: nfceAttempt.nfceId,
      bling_synced_at: new Date().toISOString(),
      bling_last_error: nfceAttempt.error
        ? `pedido_ok; nfce: ${nfceAttempt.error}`.slice(0, 500)
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (updateError) {
    return {
      ok: false,
      error: 'db_update_failed',
      message: `Pedido criado no Bling (#${createdPedidoId}), mas falhou ao salvar o vínculo local.`,
    }
  }

  const pedidoUrl = blingPedidoVendaUrl(createdPedidoId)
  const nfceUrl = nfceAttempt.nfceId ? blingNfceUrl(nfceAttempt.nfceId) : null
  const preferredUrl = blingOrderPreferredUrl({
    blingPedidoId: createdPedidoId,
    blingNfceId: nfceAttempt.nfceId,
  }) || pedidoUrl

  return {
    ok: true,
    blingPedidoId: createdPedidoId,
    blingNfceId: nfceAttempt.nfceId,
    pedidoUrl,
    nfceUrl,
    preferredUrl,
    alreadySynced: false,
    nfceGenerated: Boolean(nfceAttempt.nfceId),
    nfceError: nfceAttempt.error,
  }
}
