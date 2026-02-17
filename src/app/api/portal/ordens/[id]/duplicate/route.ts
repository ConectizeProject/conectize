import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { data: order, error } = await auth.supabase
    .from('service_orders')
    .select(
      'id, customer_id, title, status, device_model_id, imei, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, customer_description, internal_description, receiving_notes, services, brand, model, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full ), device_models ( id, brand, device_type, model )'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 })
  }

  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const dm = Array.isArray(order.device_models) ? order.device_models[0] : order.device_models

  const services = Array.isArray(order.services) ? order.services : []
  const servicesFormatted = services.map((s: { description?: string; valueCents?: number; costCents?: number }, i: number) => ({
    id: `dup-${id}-${i}`,
    description: String(s?.description ?? '').trim(),
    value: (s?.valueCents ?? 0) ? ((Number(s.valueCents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '',
    cost: (s?.costCents ?? 0) ? ((Number(s.costCents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '',
  }))

  let estimatedReadyAt = ''
  if (order.estimated_ready_at) {
    const d = new Date(order.estimated_ready_at)
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0')
      estimatedReadyAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }

  const duplicateData = {
    customerId: order.customer_id ?? '',
    customer: cust
      ? {
          id: cust.id,
          cpf: cust.cpf ?? null,
          cnpj: cust.cnpj ?? null,
          is_company: cust.is_company ?? false,
          full_name: cust.full_name ?? null,
          company_name: cust.company_name ?? null,
          trade_name: cust.trade_name ?? null,
          email: cust.email ?? null,
          mobile_phone: cust.mobile_phone ?? null,
          contact_phone: cust.contact_phone ?? null,
          contact_notes: cust.contact_notes ?? null,
          address_full: cust.address_full ?? null,
        }
      : null,
    documentDigits: cust?.cnpj ? String(cust.cnpj).replace(/\D/g, '').slice(0, 14) : (cust?.cpf ? String(cust.cpf).replace(/\D/g, '').slice(0, 11) : ''),
    title: order.title ? `${order.title} (cópia)` : '',
    status: 'orcamento' as const,
    deviceModelId: order.device_model_id ?? (dm?.id ?? ''),
    brand: dm?.brand ?? order.brand ?? '',
    deviceType: dm?.device_type ?? '',
    model: dm?.model ?? order.model ?? '',
    imei: order.imei ?? '',
    isWarranty: Boolean(order.is_warranty),
    estimatedReadyAt,
    passcodeType: order.passcode_type === 'text' || order.passcode_type === 'pattern' ? order.passcode_type : 'none',
    passcodeText: order.passcode_type === 'text' ? (order.passcode_text ?? '') : '',
    passcodePattern: order.passcode_type === 'pattern' ? (order.passcode_pattern ?? '') : '',
    customerDescription: order.customer_description ?? '',
    internalDescription: order.internal_description ?? '',
    receivingNotes: order.receiving_notes ?? '',
    services: servicesFormatted,
  }

  return NextResponse.json({ ok: true, order: duplicateData })
}
