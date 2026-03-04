import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { buildOrdemLabelHtml } from '@/lib/ordem-print'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return new NextResponse('Não autorizado', { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return new NextResponse('ID obrigatório', { status: 400 })
  }

  const { data: order, error } = await auth.supabase
    .from('service_orders')
    .select(
      'display_number, title, created_at, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, customers ( full_name, is_company, company_name, mobile_phone ), device_models ( model, device_types ( name, device_brands ( name ) ) )'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !order) {
    return new NextResponse('Ordem não encontrada', { status: 404 })
  }

  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const dm = Array.isArray(order.device_models) ? order.device_models[0] : order.device_models
  const nameForFirst = cust?.is_company
    ? (cust.company_name ?? '').trim()
    : (cust?.full_name ?? '').trim()
  const customerFirstName = nameForFirst ? nameForFirst.split(/\s+/)[0] ?? null : null
  const dt = dm?.device_types || null
  const brandRow = dt?.device_brands || null
  const brandName = brandRow?.name ?? ''
  const deviceTypeName = dt?.name ?? ''
  const deviceModel = dm
    ? (brandName.toLowerCase() === 'apple'
        ? `${deviceTypeName || ''} ${dm.model || ''}`.trim()
        : `${brandName || ''} ${dm.model || ''}`.trim()) || null
    : null

  const labelData = {
    displayNumber: order.display_number ?? id,
    title: order.title ?? '',
    createdAt: order.created_at ?? '',
    estimatedReadyAt: order.estimated_ready_at ?? null,
    passcodeType:
      order.passcode_type === 'text' || order.passcode_type === 'pattern'
        ? order.passcode_type
        : null,
    passcodeText: order.passcode_type === 'text' ? (order.passcode_text ?? null) : null,
    passcodePattern:
      order.passcode_type === 'pattern' ? (order.passcode_pattern ?? null) : null,
    customerFirstName: customerFirstName || null,
    customerMobile: cust?.mobile_phone ?? null,
    deviceModel,
  }

  const html = buildOrdemLabelHtml(labelData)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
