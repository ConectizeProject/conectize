import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  buildOrdemPrintHtml,
  type CompanyPrintData,
  type OrdemPrintData,
} from '@/lib/ordem-print'

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
  if (normalizedRole === 'user') return { ok: false as const, error: 'forbidden' }

  return { ok: true as const, supabase }
}

function orderToPrintData(order: any): OrdemPrintData {
  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const dm = Array.isArray(order.device_models) ? order.device_models[0] : order.device_models
  const device = dm
    ? (dm.brand?.toLowerCase() === 'apple'
        ? `${dm.device_type || ''} ${dm.model || ''}`.trim()
        : `${dm.brand || ''} ${dm.model || ''}`.trim()) || '-'
    : order.brand || order.model
      ? `${order.brand || ''} ${order.model || ''}`.trim()
      : '-'

  return {
    displayNumber: order.display_number ?? order.id,
    status: order.status,
    title: order.title,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    closedAt: order.closed_at ?? null,
    customer: {
      fullName: cust?.full_name ?? '',
      companyName: cust?.company_name ?? null,
      isCompany: Boolean(cust?.is_company),
      cpf: cust?.cpf ?? null,
      cnpj: cust?.cnpj ?? null,
      email: cust?.email ?? null,
      mobilePhone: cust?.mobile_phone ?? null,
      contactPhone: cust?.contact_phone ?? null,
      contactNotes: cust?.contact_notes ?? null,
      addressFull: cust?.address_full ?? null,
    },
    device,
    imei: order.imei ?? null,
    isWarranty: Boolean(order.is_warranty),
    estimatedReadyAt: order.estimated_ready_at ?? null,
    customerDescription: order.customer_description ?? null,
    internalDescription: order.internal_description ?? null,
    receivingNotes: order.receiving_notes ?? null,
    assistanceInfo: order.assistance_info ?? null,
    services:
      (order.services as Array<{ description?: string; valueCents?: number; costCents?: number }>) ??
      [],
  }
}

function companyToPrintData(company: any): CompanyPrintData {
  return {
    name: company?.name ?? null,
    cnpj: company?.cnpj ?? null,
    address: company?.address ?? null,
    complement: company?.complement ?? null,
    zipCode: company?.zip_code ?? null,
    city: company?.city ?? null,
    state: company?.state ?? null,
    phone: company?.phone ?? null,
    email: company?.email ?? null,
    logoUrl: company?.logo_url ?? null,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  if (!id) return new NextResponse('Not Found', { status: 404 })

  const [{ data: order }, { data: company }] = await Promise.all([
    auth.supabase
      .from('service_orders')
      .select(
        'id, display_number, status, title, imei, is_warranty, estimated_ready_at, customer_description, internal_description, receiving_notes, assistance_info, services, created_at, updated_at, closed_at, brand, model, customers ( cpf, cnpj, is_company, full_name, company_name, email, mobile_phone, contact_phone, contact_notes, address_full ), device_models ( brand, device_type, model )'
      )
      .eq('id', id)
      .maybeSingle(),
    auth.supabase
      .from('company_settings')
      .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
      .eq('id', 1)
      .maybeSingle(),
  ])

  if (!order) return new NextResponse('Ordem não encontrada', { status: 404 })

  const data = orderToPrintData(order)
  const companyData = company ? companyToPrintData(company) : null

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const baseUrl = siteUrl || 'http://localhost:3000'

  const html = buildOrdemPrintHtml(data, companyData, baseUrl)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
