import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { reverseSalesOrderStock } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await reverseSalesOrderStock(auth, id)
  if (result.ok === false) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'order_not_paid'
          || result.error === 'stock_not_posted'
          ? 400
          : 500

    const message =
      result.error === 'order_not_paid'
        ? 'Só é possível estornar estoque de vendas pagas.'
        : result.error === 'stock_not_posted'
          ? 'Esta venda não possui baixa de estoque ativa.'
          : result.error === 'stock_reverse_failed'
            ? 'Não foi possível estornar o estoque.'
            : result.error

    return NextResponse.json({ ok: false, error: result.error, message }, { status })
  }

  return NextResponse.json({
    ok: true,
    had_reversal: result.hadReversal,
  })
}
