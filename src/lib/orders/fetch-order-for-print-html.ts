import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildOrdemLabelHtml,
  buildOrdemPrintHtml,
  type CompanyPrintData,
  type OrdemLabelData,
  type OrdemPrintData,
} from '@/lib/ordem-print'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { toDateTimeLocalInBrazil } from '@/lib/utils/previsao-ordem'

function getCustomerFromOrder (order: Record<string, unknown>) {
  const customer = order?.customers
  if (Array.isArray(customer)) return customer[0] || null
  return customer || null
}

function getDeviceModelFromOrder (order: Record<string, unknown>) {
  const deviceModel = order?.device_models
  if (Array.isArray(deviceModel)) return deviceModel[0] || null
  return deviceModel || null
}

function firstNameFromCustomer (c: Record<string, unknown> | null): string | null {
  if (!c) return null
  const name = c.is_company
    ? String(c.company_name || c.trade_name || '').trim()
    : String(c.full_name || '').trim()
  const parts = name.split(/\s+/).filter(Boolean)
  return parts[0] || null
}

function buildDeviceString (order: Record<string, unknown>, dm: Record<string, unknown> | null): string {
  if (dm) {
    const dtRaw = dm.device_types
    const dt = (Array.isArray(dtRaw) ? dtRaw[0] : dtRaw) as Record<string, unknown> | null
    const brandRaw = dt?.device_brands
    const brandRow = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw
    const brandName = String((brandRow as { name?: string } | null)?.name ?? order.brand ?? '').trim()
    const typeName = String((dt as { name?: string } | null)?.name ?? '').trim()
    const model = String(dm.model ?? order.model ?? '').trim()
    return [brandName, typeName, model].filter(Boolean).join(' ') || '-'
  }
  const b = String(order.brand ?? '').trim()
  const m = String(order.model ?? '').trim()
  return [b, m].filter(Boolean).join(' ') || '-'
}

function normalizeServicesForPrint (raw: unknown): OrdemPrintData['services'] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const data = parsed as Record<string, unknown>
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(parsed) ? parsed : []
    return (items as unknown[])
      .slice(0, 100)
      .map((item) => {
        const i = item as Record<string, unknown>
        const kind = i.kind === 'product' ? 'product' : 'service'
        const quantity =
          kind === 'product'
            ? Math.min(9999, Math.max(1, Number(i.quantity) || 1))
            : 1
        const unitValue = Math.max(0, Number(i.unitValueCents ?? i.valueCents ?? 0) || 0)
        const unitCost = Math.max(0, Number(i.unitCostCents ?? i.costCents ?? 0) || 0)
        return {
          description: String(i.description ?? '').trim() || '-',
          valueCents: unitValue * quantity,
          costCents: unitCost * quantity,
        }
      })
  } catch {
    return []
  }
}

const ORDER_PRINT_SELECT = `
  id,
  display_number,
  status,
  title,
  imei,
  is_warranty,
  estimated_ready_at,
  passcode_type,
  passcode_text,
  passcode_pattern,
  customer_description,
  receiving_notes,
  warranty_text,
  services,
  device_entry_checks,
  brand,
  model,
  created_at,
  updated_at,
  closed_at,
  description,
  customers (
    cpf, cnpj, is_company, full_name, company_name, trade_name,
    email, mobile_phone, contact_phone, contact_notes, address_full
  ),
  device_models (
    model,
    device_types ( name, device_brands ( name ) )
  )
`

export async function buildOrderPrintAndLabelHtml (
  supabase: SupabaseClient,
  orderId: string,
  requestOrigin: string,
): Promise<{ status: number; html?: string; labelHtml?: string }> {
  const { data: order, error } = await supabase
    .from('service_orders')
    .select(ORDER_PRINT_SELECT)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[buildOrderPrintAndLabelHtml]', error)
    return { status: 500 }
  }
  if (!order) {
    return { status: 404 }
  }

  const o = order as Record<string, unknown>
  const customer = getCustomerFromOrder(o) as Record<string, unknown> | null
  const deviceModel = getDeviceModelFromOrder(o) as Record<string, unknown> | null
  const device = buildDeviceString(o, deviceModel)

  const { data: assistRows } = await supabase
    .from('service_order_assistance_comments')
    .select('content')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: true })

  const assistanceInfo =
    assistRows && assistRows.length > 0
      ? assistRows.map((r: { content: string }) => String(r.content || '').trim()).filter(Boolean).join('\n\n')
      : null

  const { data: companyRow } = await supabase
    .from('company_settings')
    .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
    .eq('id', 1)
    .maybeSingle()

  const company: CompanyPrintData | null = companyRow
    ? {
      name: companyRow.name ?? null,
      cnpj: companyRow.cnpj ?? null,
      address: companyRow.address ?? null,
      complement: companyRow.complement ?? null,
      zipCode: companyRow.zip_code ?? null,
      city: companyRow.city ?? null,
      state: companyRow.state ?? null,
      phone: companyRow.phone ?? null,
      email: companyRow.email ?? null,
      logoUrl: companyRow.logo_url ?? null,
    }
    : null

  const isCompany = Boolean(customer?.is_company)
  const printData: OrdemPrintData = {
    displayNumber: o.display_number as number | string | null,
    status: String(o.status ?? ''),
    title: String(o.title ?? ''),
    createdAt: String(o.created_at ?? ''),
    updatedAt: String(o.updated_at ?? ''),
    closedAt: o.closed_at ? String(o.closed_at) : null,
    customer: {
      fullName: String(customer?.full_name ?? ''),
      companyName: customer?.company_name != null ? String(customer.company_name) : null,
      isCompany,
      cpf: customer?.cpf != null ? String(customer.cpf) : null,
      cnpj: customer?.cnpj != null ? String(customer.cnpj) : null,
      email: customer?.email != null ? String(customer.email) : null,
      mobilePhone: customer?.mobile_phone != null ? String(customer.mobile_phone) : null,
      contactPhone: customer?.contact_phone != null ? String(customer.contact_phone) : null,
      contactNotes: customer?.contact_notes != null ? String(customer.contact_notes) : null,
      addressFull: customer?.address_full != null ? String(customer.address_full) : null,
    },
    device,
    imei: o.imei != null ? String(o.imei) : null,
    isWarranty: Boolean(o.is_warranty),
    estimatedReadyAt: o.estimated_ready_at ? String(o.estimated_ready_at) : null,
    customerDescription: o.customer_description != null ? String(o.customer_description) : null,
    internalDescription: o.description != null ? String(o.description) : null,
    receivingNotes: o.receiving_notes != null ? String(o.receiving_notes) : null,
    assistanceInfo,
    warrantyText: o.warranty_text != null ? String(o.warranty_text) : null,
    services: normalizeServicesForPrint(o.services),
    deviceEntryChecks: o.device_entry_checks ?? null,
  }

  const pt = o.passcode_type
  const passType = pt === 'text' || pt === 'pattern' ? pt : null

  const labelData: OrdemLabelData = {
    displayNumber: o.display_number as number | string,
    title: String(o.title ?? ''),
    createdAt: String(o.created_at ?? ''),
    estimatedReadyAt: o.estimated_ready_at ? String(o.estimated_ready_at) : null,
    passcodeType: passType,
    passcodeText: o.passcode_text != null ? String(o.passcode_text) : null,
    passcodePattern: o.passcode_pattern != null ? String(o.passcode_pattern) : null,
    customerFirstName: firstNameFromCustomer(customer),
    customerMobile: customer?.mobile_phone ? formatPhoneBr(String(customer.mobile_phone)) : null,
    deviceModel: device !== '-' ? device : null,
  }

  const html = buildOrdemPrintHtml(printData, company, requestOrigin)
  const labelHtml = buildOrdemLabelHtml(labelData)

  return { status: 200, html, labelHtml }
}

export function requestOriginFromNext (request: Request): string {
  try {
    return new URL(request.url).origin
  } catch {
    return ''
  }
}

export function estimatedReadyAtForDuplicateForm (iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return ''
  return toDateTimeLocalInBrazil(d)
}
