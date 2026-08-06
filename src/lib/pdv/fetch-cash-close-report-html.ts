import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompanyPrintData } from '@/lib/ordem-print'
import {
  buildCashCloseSummary,
  parseCountedByMethod,
  type PaymentMethodType,
} from '@/lib/pdv/cash-close-summary'
import {
  buildCashCloseReportHtml,
  type CashCloseReportMeta,
} from '@/lib/pdv/cash-close-report'
import { getOpenCashSession } from '@/lib/pdv/service'

type AuthCtx = {
  organizationId: string
  userId: string
  supabase: SupabaseClient
}

export type CashCloseReportInput = {
  sessionId?: string | null
  sellerName?: string | null
  countedCashCents?: number | null
  countedByMethod?: Partial<Record<PaymentMethodType, number>> | null
}

function parseClosingNotes (notes: string | null | undefined): {
  countedCashCents?: number
  countedByMethod?: Partial<Record<PaymentMethodType, number>>
} | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes) as {
      closing?: {
        counted_cash_cents?: number
        counted_by_method?: unknown
      }
    }
    const closing = parsed?.closing
    if (!closing) return null
    return {
      countedCashCents: closing.counted_cash_cents != null
        ? Math.max(0, Number(closing.counted_cash_cents) || 0)
        : undefined,
      countedByMethod: parseCountedByMethod(closing.counted_by_method),
    }
  } catch {
    return null
  }
}

export async function buildCashCloseReportHtmlForSession (
  auth: AuthCtx,
  input: CashCloseReportInput = {},
): Promise<{ status: number, html?: string, error?: string }> {
  let session: {
    id: string
    opening_amount_cents?: number | null
    created_at?: string | null
    closed_at?: string | null
    counted_cash_cents?: number | null
    notes?: string | null
  } | null = null

  if (input.sessionId) {
    const { data, error } = await auth.supabase
      .from('pos_cash_sessions')
      .select('id, opening_amount_cents, created_at, closed_at, counted_cash_cents, notes')
      .eq('organization_id', auth.organizationId)
      .eq('id', input.sessionId)
      .maybeSingle()

    if (error) return { status: 500, error: 'db_error' }
    if (!data) return { status: 404, error: 'session_not_found' }
    session = data
  } else {
    const current = await getOpenCashSession(auth)
    if (!current.ok) {
      return { status: 400, error: current.error }
    }
    session = current.session
  }

  const summaryResult = await buildCashCloseSummary(auth, session)
  if (!summaryResult.ok) {
    return { status: 500, error: 'db_error' }
  }

  const fromNotes = parseClosingNotes(session.notes)
  const countedCashCents = input.countedCashCents != null
    ? Math.max(0, Number(input.countedCashCents) || 0)
    : (session.counted_cash_cents != null
      ? Math.max(0, Number(session.counted_cash_cents) || 0)
      : fromNotes?.countedCashCents ?? null)

  const countedByMethod = input.countedByMethod && Object.keys(input.countedByMethod).length > 0
    ? input.countedByMethod
    : (fromNotes?.countedByMethod ?? null)

  const meta: CashCloseReportMeta = {
    openedAt: session.created_at ?? null,
    closedAt: session.closed_at ?? null,
    sellerName: input.sellerName ?? null,
    countedCashCents,
    countedByMethod,
  }

  const { data: companyRow } = await auth.supabase
    .from('organizations')
    .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
    .eq('id', auth.organizationId)
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

  return {
    status: 200,
    html: buildCashCloseReportHtml(summaryResult.summary, meta, company),
  }
}
