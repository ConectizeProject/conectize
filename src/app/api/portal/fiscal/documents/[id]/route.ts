import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { loadFiscalDocumentDetail, updateFiscalDocumentDraft } from '@/lib/fiscal/documents'

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const fiscalDocumentId = parseOptionalUuid(rawId)
  if (!fiscalDocumentId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const result = await loadFiscalDocumentDetail(auth, fiscalDocumentId)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error === 'not_found' ? 404 : 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: result.document,
    danfe_url: result.document.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(result.document.id)}/danfe`
      : null,
    xml_url: (result.document.status === 'authorized' || result.document.status === 'canceled')
      ? `/api/portal/fiscal/documents/${encodeURIComponent(result.document.id)}/xml`
      : null,
  })
}

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const fiscalDocumentId = parseOptionalUuid(rawId)
  if (!fiscalDocumentId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items)
    ? body.items.map((item: Record<string, unknown>) => ({
      productId: String(item.productId || item.product_id || ''),
      ncm: item.ncm == null ? null : String(item.ncm),
      cest: item.cest == null ? null : String(item.cest),
      fiscalOrigin: item.fiscalOrigin == null && item.fiscal_origin == null
        ? null
        : Number(item.fiscalOrigin ?? item.fiscal_origin),
      fci: item.fci == null ? null : String(item.fci),
      fiscalUnit: item.fiscalUnit == null && item.fiscal_unit == null
        ? null
        : String(item.fiscalUnit ?? item.fiscal_unit),
    }))
    : undefined

  const payments = Array.isArray(body?.payments)
    ? body.payments.map((payment: Record<string, unknown>) => ({
      id: String(payment.id || ''),
      paymentMethodId: payment.paymentMethodId == null && payment.payment_method_id == null
        ? undefined
        : (payment.paymentMethodId ?? payment.payment_method_id) == null
          ? null
          : String(payment.paymentMethodId ?? payment.payment_method_id),
      paymentMethodType: payment.paymentMethodType == null && payment.payment_method_type == null
        ? undefined
        : String(payment.paymentMethodType ?? payment.payment_method_type),
    }))
    : undefined

  const result = await updateFiscalDocumentDraft(auth, fiscalDocumentId, {
    customerName: body?.customer_name == null ? undefined : String(body.customer_name),
    customerDocument: body?.customer_document == null ? undefined : String(body.customer_document),
    items,
    payments,
  })

  if (!result.ok) {
    const status = result.error === 'not_found'
      ? 404
      : result.error === 'db_error'
        ? 500
        : 400
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : undefined,
    }, { status })
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: result.document,
    danfe_url: result.document.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(result.document.id)}/danfe`
      : null,
    xml_url: (result.document.status === 'authorized' || result.document.status === 'canceled')
      ? `/api/portal/fiscal/documents/${encodeURIComponent(result.document.id)}/xml`
      : null,
  })
}
