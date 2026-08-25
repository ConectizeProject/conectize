import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompanyPrintData } from '@/lib/ordem-print'
import { requestOriginFromNext } from '@/lib/orders/fetch-order-for-print-html'
import {
  buildOrcamentoPrintHtml,
  type QuotePrintData,
  type QuotePrintItem,
} from '@/lib/quotes/quote-print'

function getCustomerFromQuote (quote: Record<string, unknown>) {
  const customer = quote?.customers
  if (Array.isArray(customer)) return customer[0] || null
  return customer || null
}

export function normalizeQuoteItemsForPrint (raw: unknown): QuotePrintItem[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : []
    return items.slice(0, 100).map((item) => {
      const i = item as Record<string, unknown>
      const kind = i.kind === 'product' ? 'product' : 'service'
      const quantity =
        kind === 'product'
          ? Math.min(9999, Math.max(1, Number(i.quantity) || 1))
          : 1
      const unitValue = Math.max(0, Number(i.unitValueCents ?? i.valueCents ?? 0) || 0)
      return {
        description: String(i.description ?? '').trim() || '-',
        quantity,
        valueCents: unitValue * quantity,
      }
    })
  } catch {
    return []
  }
}

const QUOTE_PRINT_SELECT = `
  id,
  organization_id,
  display_number,
  status,
  title,
  notes,
  items,
  items_total_cents,
  valid_until,
  created_at,
  customers (
    cpf, cnpj, is_company, full_name, company_name, trade_name,
    email, mobile_phone, contact_phone, contact_notes, address_full
  )
`

export async function buildQuotePrintHtml (
  supabase: SupabaseClient,
  quoteId: string,
  requestOrigin: string,
  options?: { autoPrint?: boolean; includeStatus?: boolean },
): Promise<{ status: number; html?: string }> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_PRINT_SELECT)
    .eq('id', quoteId)
    .maybeSingle()

  if (error) {
    console.warn(`[quote-print] ${String(error.code || '')} ${String(error.message || '')}`.trim())
    return { status: 500 }
  }
  if (!data) return { status: 404 }

  const o = data as Record<string, unknown>
  const customer = getCustomerFromQuote(o) as Record<string, unknown> | null
  const orgId = o.organization_id != null ? String(o.organization_id) : null
  const { data: companyRow } = orgId
    ? await supabase
      .from('organizations')
      .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
      .eq('id', orgId)
      .maybeSingle()
    : { data: null }

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
  const items = normalizeQuoteItemsForPrint(o.items)
  const totalCents = Math.max(
    0,
    Number(o.items_total_cents) || items.reduce((acc, s) => acc + s.valueCents, 0),
  )

  const printData: QuotePrintData = {
    displayNumber: o.display_number as number | string | null,
    status: String(o.status ?? ''),
    title: String(o.title ?? ''),
    createdAt: String(o.created_at ?? ''),
    validUntil: o.valid_until != null ? String(o.valid_until).slice(0, 10) : null,
    notes: o.notes != null ? String(o.notes) : null,
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
    items,
    totalCents,
  }

  return {
    status: 200,
    html: buildOrcamentoPrintHtml(printData, company, requestOrigin, {
      autoPrint: options?.autoPrint !== false,
      includeStatus: options?.includeStatus === true,
    }),
  }
}

export { requestOriginFromNext }
