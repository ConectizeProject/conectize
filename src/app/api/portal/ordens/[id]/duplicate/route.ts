import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { estimatedReadyAtForDuplicateForm } from '@/lib/orders/fetch-order-for-print-html'
import { formatMoneyInputBr } from '@/lib/utils/format-money'

function onlyDigits (s: string): string {
  return String(s || '').replace(/\D/g, '')
}

/** Status permitidos na tela "Nova ordem" (Yup + createOrderAction). */
const NOVA_ORDEM_STATUS = new Set([
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
])

function statusForNovaOrdemForm (raw: unknown): string {
  const s = String(raw ?? 'orcamento').trim()
  return NOVA_ORDEM_STATUS.has(s) ? s : 'orcamento'
}

function mapServicesForDuplicateForm (raw: unknown): unknown[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const data = parsed as Record<string, unknown>
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(parsed) ? parsed : []
    return (items as Record<string, unknown>[]).map((item, index) => {
      const kind = item.kind === 'product' ? 'product' : 'service'
      const quantity =
        kind === 'product'
          ? String(Math.min(9999, Math.max(1, Math.trunc(Number(item.quantity) || 1))))
          : '1'
      const unitValueCents = Math.max(
        0,
        Number(item.unitValueCents ?? item.valueCents ?? 0) || 0,
      )
      const unitCostCents = Math.max(
        0,
        Number(item.unitCostCents ?? item.costCents ?? 0) || 0,
      )
      const desc = String(item.description ?? '').trim()
      const pid = item.sourceProductId
      const noCost = item.noCost === true
      return {
        id: `dup-${index}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind,
        description: desc,
        quantity,
        value: unitValueCents ? formatMoneyInputBr(String(unitValueCents)) : '',
        cost: noCost
          ? ''
          : unitCostCents
            ? formatMoneyInputBr(String(unitCostCents))
            : '',
        sourceProductId: pid ? String(pid).trim() : null,
        noCost,
      }
    })
  } catch {
    return []
  }
}

const CUSTOMER_SELECT = `
  id,
  cpf, cnpj, is_company, full_name, company_name, trade_name,
  email, mobile_phone, contact_phone, contact_notes, address_full,
  zip_code, state, city, neighborhood, street, street_number, street_complement,
  birth_date, referral_source, referral_source_other
`

export async function GET (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: order, error } = await auth.supabase
    .from('service_orders')
    .select(`
      id,
      customer_id,
      status,
      title,
      device_model_id,
      color,
      device_location,
      imei,
      is_warranty,
      estimated_ready_at,
      passcode_type,
      passcode_text,
      passcode_pattern,
      payment_methods,
      customer_description,
      receiving_notes,
      services,
      device_entry_checks,
      discount_cents,
      discount_mode,
      discount_percent,
      commission_user_id,
      commission_kind,
      commission_fixed_cents,
      commission_percent,
      customers (${CUSTOMER_SELECT}),
      device_models (
        id,
        model,
        device_types ( name, device_brands ( name ) )
      )
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[duplicate GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const o = order as Record<string, unknown>
  const custRaw = o.customers
  const cust = (Array.isArray(custRaw) ? custRaw[0] : custRaw) as Record<string, unknown> | null
  const dmRaw = o.device_models
  const dm = (Array.isArray(dmRaw) ? dmRaw[0] : dmRaw) as Record<string, unknown> | null
  const dtRaw = dm?.device_types
  const dt = Array.isArray(dtRaw) ? dtRaw[0] : dtRaw
  const deviceType = dt && typeof dt === 'object' ? String((dt as { name?: string }).name ?? '') : ''
  const brandRaw =
    dt && typeof dt === 'object'
      ? (dt as { device_brands?: unknown }).device_brands
      : null
  const brandRow = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw
  const brandName =
    brandRow && typeof brandRow === 'object'
      ? String((brandRow as { name?: string }).name ?? '')
      : ''
  const modelName = dm ? String(dm.model ?? '') : ''

  let documentDigits = ''
  if (cust) {
    documentDigits = cust.is_company
      ? onlyDigits(String(cust.cnpj || ''))
      : onlyDigits(String(cust.cpf || ''))
  }

  const { data: lastInternal } = await auth.supabase
    .from('service_order_internal_comments')
    .select('content')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const internalInitialComment = lastInternal?.content
    ? String(lastInternal.content)
    : ''

  const passcodeTypeRaw = String(o.passcode_type || '')
  const passcodeType =
    passcodeTypeRaw === 'text' || passcodeTypeRaw === 'pattern' ? passcodeTypeRaw : 'none'

  let paymentMethods: unknown = o.payment_methods
  if (typeof paymentMethods === 'string') {
    try {
      paymentMethods = JSON.parse(paymentMethods)
    } catch {
      paymentMethods = []
    }
  }
  const pmList = Array.isArray(paymentMethods) ? paymentMethods : []
  const firstPm = pmList[0] as Record<string, unknown> | undefined
  const paymentMethodId = firstPm?.payment_method_id
    ? String(firstPm.payment_method_id)
    : null
  const installments = firstPm?.installments != null ? Number(firstPm.installments) : null

  const payload = {
    customerId: o.customer_id ? String(o.customer_id) : '',
    documentDigits,
    title: String(o.title ?? ''),
    status: statusForNovaOrdemForm(o.status),
    deviceModelId: o.device_model_id ? String(o.device_model_id) : '',
    brand: brandName,
    model: modelName,
    deviceType,
    imei: String(o.imei ?? ''),
    color: String(o.color ?? ''),
    deviceLocation: String(o.device_location ?? ''),
    isWarranty: Boolean(o.is_warranty),
    estimatedReadyAt: estimatedReadyAtForDuplicateForm(
      o.estimated_ready_at ? String(o.estimated_ready_at) : null,
    ),
    passcodeType,
    passcodeText: String(o.passcode_text ?? ''),
    passcodePattern: String(o.passcode_pattern ?? ''),
    paymentMethods: pmList.length > 0 ? pmList : null,
    paymentMethodId,
    installments,
    discountMode: String(o.discount_mode || 'fixed') === 'percent' ? 'percent' : 'fixed',
    discountFixedCents: Math.max(0, Number(o.discount_cents) || 0),
    discountPercent: Math.max(0, Number(o.discount_percent) || 0),
    commissionUserId: o.commission_user_id ? String(o.commission_user_id) : '',
    commissionKind: String(o.commission_kind || 'percent') === 'fixed' ? 'fixed' : 'percent',
    commissionFixedCents: Math.max(0, Number(o.commission_fixed_cents) || 0),
    commissionPercent: Math.max(0, Number(o.commission_percent) || 0),
    customerDescription: String(o.customer_description ?? ''),
    internalInitialComment,
    receivingNotes: String(o.receiving_notes ?? ''),
    services: mapServicesForDuplicateForm(o.services),
    deviceEntryChecks: o.device_entry_checks ?? null,
    customer: cust,
  }

  return NextResponse.json({ ok: true, order: payload })
}
