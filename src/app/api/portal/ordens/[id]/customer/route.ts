import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { isFinalizedOrderStatus } from '@/lib/orders/order-status'
import { buildOrderEditDiff } from '@/lib/orders/order-edit-history'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'

function customerHistoryLabel (row: {
  id?: string
  is_company?: boolean | null
  full_name?: string | null
  company_name?: string | null
  trade_name?: string | null
  cpf?: string | null
  cnpj?: string | null
} | null): string {
  if (!row?.id) return '(sem cliente)'
  const name = row.is_company
    ? String(row.company_name || row.trade_name || row.full_name || 'Empresa').trim()
    : String(row.full_name || 'Cliente').trim()
  const doc = formatCpfCnpj(onlyDigits(String(row.cnpj || row.cpf || '')).slice(0, 14))
  return doc ? `${name} • ${doc}` : name
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
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const customerId = parseOptionalUuid(body?.customerId ?? body?.customer_id)
  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'invalid_customer' }, { status: 400 })
  }

  const { data: existing, error: findErr } = await auth.supabase
    .from('service_orders')
    .select('id, customer_id, status, organization_id')
    .eq('id', orderId)
    .maybeSingle()

  if (findErr) {
    console.error('[ordens customer PATCH find]', findErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const isFinalized = isFinalizedOrderStatus(String(existing.status || ''))
  if (isFinalized && !auth.isAdmin) {
    return NextResponse.json({ ok: false, error: 'order_finalized' }, { status: 403 })
  }

  if (String(existing.customer_id || '') === customerId) {
    return NextResponse.json({ ok: true, unchanged: true, customerId })
  }

  const { data: nextCustomer, error: custErr } = await auth.supabase
    .from('customers')
    .select('id, is_company, full_name, company_name, trade_name, cpf, cnpj')
    .eq('id', customerId)
    .maybeSingle()

  if (custErr || !nextCustomer?.id) {
    return NextResponse.json({ ok: false, error: 'invalid_customer' }, { status: 400 })
  }

  let previousCustomer: {
    id?: string
    is_company?: boolean | null
    full_name?: string | null
    company_name?: string | null
    trade_name?: string | null
    cpf?: string | null
    cnpj?: string | null
  } | null = null
  const prevId = parseOptionalUuid(existing.customer_id)
  if (prevId) {
    const { data: prev } = await auth.supabase
      .from('customers')
      .select('id, is_company, full_name, company_name, trade_name, cpf, cnpj')
      .eq('id', prevId)
      .maybeSingle()
    previousCustomer = prev
  }

  const { error: upErr } = await auth.supabase
    .from('service_orders')
    .update({ customer_id: customerId })
    .eq('id', orderId)

  if (upErr) {
    console.error('[ordens customer PATCH update]', upErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const organizationId = String(existing.organization_id || auth.organizationId || '').trim()
  if (organizationId) {
    const diffRows = buildOrderEditDiff(
      {
        customer_id: customerHistoryLabel(previousCustomer),
      },
      {
        customer_id: customerHistoryLabel(nextCustomer),
      },
    )
    if (diffRows.length > 0) {
      const { error: histErr } = await auth.supabase
        .from('service_order_edit_history')
        .insert(
          diffRows.map((r) => ({
            service_order_id: orderId,
            organization_id: organizationId,
            edited_by: auth.userId,
            edited_at: new Date().toISOString(),
            field_key: r.field_key,
            old_value: r.old_value,
            new_value: r.new_value,
          })),
        )
      if (histErr) {
        console.error('[ordens customer PATCH history]', histErr)
      }
    }
  }

  return NextResponse.json({ ok: true, customerId })
}
