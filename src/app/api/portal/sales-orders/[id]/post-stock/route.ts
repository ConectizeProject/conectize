import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { postSalesOrderStock } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await postSalesOrderStock(auth, id)
  if (result.ok === false) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'order_not_paid'
          || result.error === 'stock_already_posted'
          || result.error === 'empty_order'
          ? 400
          : 500

    const message =
      result.error === 'order_not_paid'
        ? 'Só é possível lançar estoque de vendas pagas.'
        : result.error === 'stock_already_posted'
          ? 'Esta venda já possui estoque lançado.'
          : result.error === 'empty_order'
            ? 'Pedido sem itens para baixar estoque.'
            : result.error === 'stock_apply_failed'
              ? 'Não foi possível lançar o estoque.'
              : result.error

    return NextResponse.json({ ok: false, error: result.error, message }, { status })
  }

  return NextResponse.json({ ok: true })
}
