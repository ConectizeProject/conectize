import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  deleteInboundNfeItem,
  linkInboundNfeItem,
  updateInboundNfeItemFiscal,
} from '@/lib/fiscal/inbound-nfe'

type Params = { params: Promise<{ id: string, itemId: string }> }

export async function PATCH (request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id, itemId } = await params
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (body?.action === 'fiscal') {
    const result = await updateInboundNfeItemFiscal(auth, String(id || ''), String(itemId || ''), {
      ncm: String(body.ncm || ''),
      cest: body.cest ? String(body.cest) : null,
      unit: String(body.unit || 'UN'),
      cfop: String(body.cfop || ''),
      fiscalOrigin: Number(body.fiscal_origin),
      icmsCsosn: String(body.icms_csosn || ''),
      pisCst: String(body.pis_cst || ''),
      cofinsCst: String(body.cofins_cst || ''),
      ipiCst: body.ipi_cst ? String(body.ipi_cst) : null,
      quantity: body.quantity == null ? undefined : Number(body.quantity),
      unitValueCents: body.unit_value_cents == null ? undefined : Number(body.unit_value_cents),
      description: body.description == null ? undefined : String(body.description),
      productCode: body.product_code == null ? undefined : String(body.product_code),
      barcode: body.barcode == null ? undefined : String(body.barcode),
    })
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: 'message' in result ? result.message : 'Não foi possível salvar os dados fiscais.',
      }, { status: result.error === 'not_found' ? 404 : 400 })
    }
    return NextResponse.json({ ok: true, document: result.document })
  }

  const productIdRaw = body?.productId
  const productId = productIdRaw === null || productIdRaw === undefined || productIdRaw === ''
    ? null
    : String(productIdRaw)

  const result = await linkInboundNfeItem(auth, String(id || ''), String(itemId || ''), productId)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 400
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Não foi possível vincular o item.',
    }, { status })
  }
  return NextResponse.json({ ok: true, document: result.document })
}

export async function DELETE (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id, itemId } = await params
  const result = await deleteInboundNfeItem(auth, String(id || ''), String(itemId || ''))
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Não foi possível excluir o item.',
    }, { status: result.error === 'not_found' ? 404 : 400 })
  }

  return NextResponse.json({ ok: true, document: result.document })
}
