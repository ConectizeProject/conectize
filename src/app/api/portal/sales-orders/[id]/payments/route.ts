import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { updateSalesOrderDraft, type SalesOrderPaymentInput } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const payments = (Array.isArray(body?.payments) ? body.payments : [])
    .map((payment: {
      payment_method_id?: string | null
      payment_method_type?: SalesOrderPaymentInput['payment_method_type']
      amount_cents?: number
      status?: SalesOrderPaymentInput['status']
      installments?: number
      metadata?: Record<string, unknown> | null
    }) => ({
      payment_method_id: payment?.payment_method_id ?? null,
      payment_method_type: payment?.payment_method_type,
      amount_cents: Number(payment?.amount_cents) || 0,
      status: payment?.status ?? 'paid',
      installments: Number(payment?.installments) || 1,
      metadata: payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : null,
    }))
    .filter((payment: SalesOrderPaymentInput) => (
      Boolean(payment.payment_method_type) && Number(payment.amount_cents) > 0
    )) as SalesOrderPaymentInput[]

  const result = await updateSalesOrderDraft(auth, id, {}, undefined, payments)
  if (!result.ok) {
    const status = result.error === 'not_found'
      ? 404
      : result.error === 'order_not_editable' || result.error === 'payment_insufficient'
        ? 400
        : 500
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: result.error === 'payment_insufficient'
        ? 'O total ficou maior que o valor pago. Ajuste as formas de pagamento.'
        : undefined,
    }, { status })
  }

  return NextResponse.json({ ok: true })
}
