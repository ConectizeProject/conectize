import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  getInboundNfeDocument,
  updateInboundNfeFiscalSettings,
  updateInboundNfeSeller,
} from '@/lib/fiscal/inbound-nfe'

type Params = { params: Promise<{ id: string }> }

export async function GET (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await getInboundNfeDocument(auth, String(id || ''))
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }
  return NextResponse.json({ ok: true, document: result.document })
}

export async function PATCH (request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const { id } = await params
  if (body && 'seller_customer_id' in body) {
    const customerId = String(body.seller_customer_id || '').trim()
    if (!customerId) {
      return NextResponse.json({
        ok: false,
        error: 'invalid_customer',
        message: 'Selecione um cliente.',
      }, { status: 400 })
    }
    const result = await updateInboundNfeSeller(auth, String(id || ''), customerId)
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: 'message' in result ? result.message : 'Não foi possível alterar o cliente.',
      }, { status: result.error === 'not_found' ? 404 : 400 })
    }
    return NextResponse.json({ ok: true, document: result.document })
  }

  const purpose = body?.fiscal_purpose
  if (purpose !== 'resale' && purpose !== 'fixed_asset' && purpose !== 'use_consumption') {
    return NextResponse.json({
      ok: false,
      error: 'invalid_fiscal_purpose',
      message: 'Selecione uma finalidade fiscal válida.',
    }, { status: 400 })
  }

  const result = await updateInboundNfeFiscalSettings(auth, String(id || ''), {
    fiscalPurpose: purpose,
    shouldMoveStock: body?.should_move_stock === true,
    operationNature: body?.operation_nature ? String(body.operation_nature) : null,
    freightCents: body?.freight_cents == null ? undefined : Number(body.freight_cents),
    insuranceCents: body?.insurance_cents == null ? undefined : Number(body.insurance_cents),
    otherExpensesCents: body?.other_expenses_cents == null ? undefined : Number(body.other_expenses_cents),
    discountCents: body?.discount_cents == null ? undefined : Number(body.discount_cents),
    transportMode: body?.transport_mode === 'buyer' || body?.transport_mode === 'seller' || body?.transport_mode === 'carrier'
      ? body.transport_mode
      : body?.transport_mode === 'none'
        ? 'none'
        : undefined,
    complementaryInformation: body && 'complementary_information' in body
      ? String(body.complementary_information || '')
      : undefined,
    fiscalInformation: body && 'fiscal_information' in body
      ? String(body.fiscal_information || '')
      : undefined,
    fiscalPayments: body && 'fiscal_payments' in body ? body.fiscal_payments : undefined,
  })
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Não foi possível atualizar a entrada.',
    }, { status: result.error === 'not_found' ? 404 : 400 })
  }

  return NextResponse.json({ ok: true, document: result.document })
}
