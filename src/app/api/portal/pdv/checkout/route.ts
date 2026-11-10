import { after, NextRequest, NextResponse } from 'next/server'
import {
  requireStaffOrAdmin,
  type PortalAuthStaffSuccess,
} from '@/lib/auth/portal-api'
import { emitNfceForSalesOrder } from '@/lib/fiscal/emit-nfce'
import {
  checkoutSalesOrder,
  postSalesOrderFinance,
  postSalesOrderStock,
} from '@/lib/sales-orders/service'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export const runtime = 'nodejs'
export const maxDuration = 60

function scheduleCheckoutSideEffects (
  auth: PortalAuthStaffSuccess,
  orderId: string,
) {
  after(async () => {
    try {
      const stock = await postSalesOrderStock(auth, orderId)
      if (
        stock.ok === false
        && stock.error !== 'stock_already_posted'
        && stock.error !== 'full_skips_local_stock'
      ) {
        console.error('[pdv checkout] post stock failed', { orderId, error: stock.error })
      }
    } catch (err) {
      console.error('[pdv checkout] post stock threw', { orderId, err })
    }

    try {
      const finance = await postSalesOrderFinance(auth, orderId)
      if (finance.ok === false && finance.error !== 'finance_already_posted') {
        console.error('[pdv checkout] post finance failed', { orderId, error: finance.error })
      }
    } catch (err) {
      console.error('[pdv checkout] post finance threw', { orderId, err })
    }
  })
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  const payments = Array.isArray(body?.payments) ? body.payments : []
  const orderId = body?.order_id != null ? String(body.order_id) : null
  const changeCents = body?.change_cents != null ? Number(body.change_cents) : undefined
  const emitNfce = body?.emit_nfce === true
  const clientMutationId = parseOptionalUuid(
    body?.client_mutation_id ?? request.headers.get('X-Pdv-Offline-Mutation-Id'),
  )

  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await checkoutSalesOrder(auth, {
    orderId,
    items,
    draft,
    payments,
    change_cents: Number.isFinite(changeCents) ? changeCents : undefined,
    clientMutationId,
  })

  if (!result.ok) {
    const error = result.error
    const status = error === 'payment_insufficient'
      || error === 'empty_order'
      || error === 'finance_sync_failed'
      || error === 'cash_not_open'
      || error === 'invalid_product'
      || error === 'order_not_editable'
      ? 400
      : error === 'not_found'
        ? 404
        : 500

    return NextResponse.json({
      ok: false,
      error,
      order_id: result.orderId,
      details: 'details' in result ? result.details : undefined,
    }, { status })
  }

  if (result.deferredSideEffects) {
    scheduleCheckoutSideEffects(auth, result.orderId)
  }

  let nfce: {
    ok: boolean
    fiscal_document: unknown
    danfe_url: string | null
    already_authorized?: boolean
    error?: string
    message?: string
    needs_correction?: boolean
  } | null = null

  if (emitNfce) {
    const emitted = await emitNfceForSalesOrder(auth, result.orderId)
    if (emitted.ok === true) {
      nfce = {
        ok: true,
        fiscal_document: emitted.fiscalDocument,
        danfe_url: emitted.fiscalDocument.status === 'authorized'
          ? `/api/portal/fiscal/documents/${encodeURIComponent(emitted.fiscalDocument.id)}/danfe`
          : null,
        already_authorized: emitted.alreadyAuthorized,
      }
    } else {
      nfce = {
        ok: false,
        fiscal_document: emitted.fiscalDocument ?? null,
        danfe_url: null,
        error: emitted.error,
        message: emitted.message,
        needs_correction: emitted.needsCorrection === true,
      }
    }
  }

  return NextResponse.json({
    ok: true,
    order_id: result.orderId,
    order: result.order,
    cupom_html: result.cupomHtml ?? null,
    nfce,
  })
}
