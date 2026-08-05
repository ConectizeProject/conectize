import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { cancelSalesOrder } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const reason = String(body?.reason || '').trim() || null

  const result = await cancelSalesOrder(auth, id, reason)
  if (!result.ok) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'cancel_reason_required'
          || result.error === 'order_not_cancellable'
          || result.error === 'already_canceled'
          || result.error === 'order_not_editable'
          ? 400
          : 500

    const message =
      result.error === 'cancel_reason_required'
        ? 'Informe o motivo do estorno da venda paga.'
        : result.error === 'already_canceled'
          ? 'Pedido já está cancelado.'
          : result.error === 'stock_reverse_failed'
            ? 'Não foi possível estornar o estoque.'
            : result.error === 'finance_sync_failed'
              ? 'Estoque revertido, mas falhou ao estornar o financeiro.'
              : result.error

    return NextResponse.json({ ok: false, error: result.error, message }, { status })
  }

  return NextResponse.json({
    ok: true,
    bling_warning: result.blingWarning,
    had_stock_reversal: result.hadStockReversal,
  })
}
