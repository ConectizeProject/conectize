import { portalFetch } from '@/lib/portal/portal-fetch'

export async function createStandaloneSalesOrder (): Promise<{
  ok: true
  orderId: string
} | {
  ok: false
  message: string
}> {
  const res = await portalFetch('/api/portal/sales-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ standalone: true, items: [] }),
  })
  const data = await res?.json().catch(() => null)
  const orderId = String(data?.order_id || data?.order?.id || '')
  if (!data?.ok || !orderId) {
    return {
      ok: false,
      message: data?.error === 'cash_not_open'
        ? 'Este pedido não depende do caixa. Tente novamente.'
        : (data?.message || data?.error || 'Erro ao criar pedido.'),
    }
  }
  return { ok: true, orderId }
}

export function salesOrderNfeEmitHref (orderId: string) {
  return `/portal/vendas/${encodeURIComponent(orderId)}?emit=nfe`
}
