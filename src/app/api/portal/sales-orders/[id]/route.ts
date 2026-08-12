import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  loadSalesOrder,
  updateSalesOrderDraft,
  type SalesOrderPaymentInput,
} from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

function parsePayments (raw: unknown): SalesOrderPaymentInput[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.map((payment) => ({
    payment_method_id: payment?.payment_method_id ?? null,
    payment_method_type: payment?.payment_method_type,
    amount_cents: Number(payment?.amount_cents) || 0,
    status: payment?.status ?? 'paid',
    installments: Number(payment?.installments) || 1,
    metadata: payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : null,
  })).filter((payment) => (
    Boolean(payment.payment_method_type) && Number(payment.amount_cents) > 0
  )) as SalesOrderPaymentInput[]
}

export async function GET (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await loadSalesOrder(auth, id)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, order: result.order, items: result.items, payments: result.payments })
}

export async function PATCH (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : undefined
  const payments = parsePayments(body?.payments)
  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await updateSalesOrderDraft(auth, id, draft, items, payments)
  if (!result.ok) {
    const status = result.error === 'not_found'
      ? 404
      : result.error === 'order_not_editable'
        || result.error === 'invalid_product'
        || result.error === 'payment_insufficient'
        || result.error === 'stock_reverse_failed'
        || result.error === 'stock_apply_failed'
        || result.error === 'finance_sync_failed'
        ? 400
        : 500
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: result.error === 'payment_insufficient'
        ? 'O total ficou maior que o valor pago. Ajuste desconto/itens ou as formas de pagamento.'
        : result.error === 'order_not_editable'
          ? 'Este pedido não pode ser editado.'
          : result.error === 'finance_sync_failed'
            ? 'Pedido salvo, mas falhou ao atualizar o lançamento no financeiro. Verifique as carteiras das formas de pagamento.'
            : undefined,
    }, { status })
  }

  const loaded = await loadSalesOrder(auth, id)
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: loaded.order, items: loaded.items, payments: loaded.payments })
}
