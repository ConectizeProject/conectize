import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { postSalesOrderFinance } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await postSalesOrderFinance(auth, id)
  if (result.ok === false) {
    const status =
      result.error === 'not_found'
        ? 404
        : result.error === 'order_not_paid'
          || result.error === 'finance_already_posted'
          || result.error === 'finance_not_posted'
          || result.error === 'finance_wallet_missing'
          ? 400
          : 500

    const message =
      result.error === 'order_not_paid'
        ? 'Só é possível lançar conta de vendas pagas.'
        : result.error === 'finance_already_posted'
          ? 'Esta venda já possui conta lançada.'
          : result.error === 'finance_wallet_missing'
            ? 'Nenhuma carteira vinculada às formas de pagamento. Configure em Financeiro.'
            : result.error === 'finance_not_posted'
              ? 'Não foi possível lançar o valor no financeiro.'
              : result.error === 'finance_sync_failed'
                ? 'Não foi possível lançar a conta.'
                : result.error

    return NextResponse.json({ ok: false, error: result.error, message }, { status })
  }

  return NextResponse.json({ ok: true })
}
