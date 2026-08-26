import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { Button } from '@/components/ui/button'
import { isValidQuoteStatus, effectiveQuoteStatus } from '@/lib/quotes/quote-status'
import {
  OrcamentosListClient,
  type QuoteListRow,
} from './OrcamentosListClient'

export const dynamic = 'force-dynamic'

export default async function OrcamentosPage ({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const query = String(q || '').trim()
  const statusFilter = String(status || '').trim()

  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/dashboard')

  let listQuery = supabase
    .from('quotes')
    .select(
      'id, display_number, title, status, valid_until, items_total_cents, share_token, created_at, service_order_id, customers ( is_company, full_name, company_name, email, mobile_phone )',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (isValidQuoteStatus(statusFilter)) {
    listQuery = listQuery.eq('status', statusFilter)
  }

  const { data, error } = await listQuery
  if (error) {
    const message = String(error.message || '').trim()
    const code = String(error.code || '').trim()
    console.warn(`[portal/orcamentos] list: ${code} ${message}`.trim())
  }

  const rawRows = (data || []) as Array<Omit<QuoteListRow, 'customers'> & { customers: QuoteListRow['customers'] | QuoteListRow['customers'][] }>
  const osIds = rawRows
    .map((r) => r.service_order_id)
    .filter((id): id is string => Boolean(id))
  const osNumberById = new Map<string, number>()
  if (osIds.length > 0) {
    const { data: osRows } = await supabase
      .from('service_orders')
      .select('id, display_number')
      .in('id', osIds)
    for (const os of osRows || []) {
      if (os.display_number != null) {
        osNumberById.set(os.id, Number(os.display_number))
      }
    }
  }

  const qLower = query.toLowerCase()
  const rows: QuoteListRow[] = rawRows
    .map((row) => {
      const customerRel = row.customers
      const customers = (Array.isArray(customerRel) ? customerRel[0] : customerRel) ?? null
      return {
        ...row,
        status: effectiveQuoteStatus(row.status, row.valid_until),
        customers,
        service_order_display_number: row.service_order_id
          ? osNumberById.get(row.service_order_id) ?? null
          : null,
      }
    })
    .filter((row) => {
      if (!qLower) return true
      const customer = row.customers
      const customerName = customer?.is_company
        ? customer.company_name || customer.full_name || ''
        : customer?.full_name || ''
      const hay = [
        String(row.display_number ?? ''),
        row.title || '',
        customerName,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(qLower)
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Propostas para o cliente, sem aparelho. Converta em OS quando aprovado.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/orcamentos/novo">Novo orçamento</Link>
        </Button>
      </div>

      <OrcamentosListClient
        rows={rows}
        q={query}
        status={isValidQuoteStatus(statusFilter) ? statusFilter : 'all'}
      />
    </div>
  )
}
