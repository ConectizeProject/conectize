import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { reverseSalesOrderFinance } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await reverseSalesOrderFinance(auth, id)
  if (result.ok === false) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'order_not_paid'
          || result.error === 'finance_not_posted'
          ? 400
          : 500

    const message =
      result.error === 'order_not_paid'
        ? 'Só é possível estornar conta de vendas pagas.'
        : result.error === 'finance_not_posted'
          ? 'Esta venda não possui conta lançada.'
          : result.error === 'finance_reverse_failed'
            ? 'Não foi possível estornar a conta.'
            : result.error

    return NextResponse.json({ ok: false, error: result.error, message }, { status })
  }

  return NextResponse.json({ ok: true })
}
