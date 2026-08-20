import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  getOfflineSale,
  isLikelyNetworkFailure,
  listActionableOfflineSales,
  updateOfflineSale,
} from './sales-queue'
import type { PdvOfflineSale } from './types'

export type SyncOfflineSalesResult = {
  attempted: number
  synced: number
  failed: number
  skipped: number
  results: Array<{
    id: string
    ok: boolean
    error?: string
    orderId?: string
    orderNumber?: number | null
  }>
}

let syncInFlight: Promise<SyncOfflineSalesResult> | null = null

function humanizeCheckoutError (code: string | undefined) {
  if (!code) return 'Não foi possível enviar a venda.'
  if (code === 'cash_not_open') return 'Caixa fechado. Abra o caixa e tente novamente.'
  if (code === 'finance_sync_failed') {
    return 'Venda paga no servidor, mas o lançamento financeiro falhou. Verifique as formas de pagamento.'
  }
  if (code === 'payment_insufficient') return 'Pagamento insuficiente.'
  if (code === 'empty_order') return 'Venda sem itens.'
  if (code === 'invalid_product') return 'Produto inválido ou indisponível.'
  if (code === 'not_authenticated') return 'Sessão expirada. Entre novamente.'
  return code
}

async function syncOneSale (sale: PdvOfflineSale): Promise<{
  ok: boolean
  error?: string
  orderId?: string
  orderNumber?: number | null
}> {
  const current = await getOfflineSale(sale.id)
  if (!current) return { ok: false, error: 'Venda offline não encontrada.' }
  if (current.status === 'synced' && current.syncedOrderId) {
    return {
      ok: true,
      orderId: current.syncedOrderId,
      orderNumber: current.syncedOrderNumber,
    }
  }

  const next: PdvOfflineSale = {
    ...current,
    status: 'syncing',
    attemptCount: current.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  }
  await updateOfflineSale(next)

  try {
    const res = await portalFetch('/api/portal/pdv/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pdv-Offline-Mutation-Id': current.id,
      },
      body: JSON.stringify({
        ...current.payload,
        client_mutation_id: current.id,
      }),
      skipAuthRedirect: true,
    })
    const data = await res?.json().catch(() => null) as {
      ok?: boolean
      error?: string
      order_id?: string
      order?: { id?: string, order_number?: number | null }
    } | null

    if (!data?.ok) {
      const error = humanizeCheckoutError(data?.error)
      await updateOfflineSale({
        ...next,
        status: 'failed',
        lastError: error,
      })
      return { ok: false, error }
    }

    const orderId = String(data.order_id || data.order?.id || '')
    const orderNumber = data.order?.order_number ?? null
    await updateOfflineSale({
      ...next,
      status: 'synced',
      lastError: null,
      syncedOrderId: orderId || null,
      syncedOrderNumber: typeof orderNumber === 'number' ? orderNumber : null,
    })
    return { ok: true, orderId, orderNumber }
  } catch (err) {
    const error = isLikelyNetworkFailure(err)
      ? 'Sem conexão. Tentaremos novamente ao reconectar.'
      : (err instanceof Error ? err.message : 'Falha ao sincronizar.')
    await updateOfflineSale({
      ...next,
      status: 'failed',
      lastError: error,
    })
    return { ok: false, error }
  }
}

export async function syncOfflineSalesQueue (organizationId: string): Promise<SyncOfflineSalesResult> {
  if (!organizationId) {
    return { attempted: 0, synced: 0, failed: 0, skipped: 0, results: [] }
  }
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    const actionable = await listActionableOfflineSales(organizationId)
    const pending = actionable.filter((row) => row.status === 'pending' || row.status === 'failed')
    const result: SyncOfflineSalesResult = {
      attempted: pending.length,
      synced: 0,
      failed: 0,
      skipped: actionable.length - pending.length,
      results: [],
    }

    for (const sale of pending) {
      const one = await syncOneSale(sale)
      result.results.push({
        id: sale.id,
        ok: one.ok,
        error: one.error,
        orderId: one.orderId,
        orderNumber: one.orderNumber,
      })
      if (one.ok) result.synced += 1
      else result.failed += 1
      if (one.error && /sem conexão|sessão expirada/i.test(one.error)) break
    }

    return result
  })()

  try {
    return await syncInFlight
  } finally {
    syncInFlight = null
  }
}
