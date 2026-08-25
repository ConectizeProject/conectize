import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { expireOverdueQuoteById } from '@/lib/quotes/expire-quotes'
import { parseOrcamentoRouteParam } from '@/lib/quotes/quote-portal-path'
import { quoteItemToFormLine, parseQuoteItemsRaw } from '@/lib/quotes/quote-items'
import { OrcamentoFormClient } from '../OrcamentoFormClient'
import { OrcamentoActionsMenu } from '../OrcamentoActionsMenu'
import { updateQuoteAction } from './update-quote-action'
import type { CustomerHit } from '@/components/customers'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'

const ERROR_MESSAGES: Record<string, string> = {
  cliente_invalido: 'Cliente inválido.',
  nao_foi_possivel_salvar: 'Não foi possível salvar o orçamento.',
}

export default async function OrcamentoDetalhePage ({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { numero } = await params
  const { error, saved } = await searchParams
  const route = parseOrcamentoRouteParam(numero)
  if (!route) redirect('/portal/orcamentos')

  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/orcamentos')

  let query = supabase
    .from('quotes')
    .select(
      `id, display_number, title, status, notes, valid_until, items, items_total_cents,
       share_token, service_order_id, customer_id, created_at,
       customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full )`,
    )
    .eq('organization_id', organizationId)

  query = route.kind === 'id'
    ? query.eq('id', route.value)
    : query.eq('display_number', route.value)

  const { data: quote } = await query.maybeSingle()
  if (!quote) redirect('/portal/orcamentos')

  const status = (await expireOverdueQuoteById(supabase, quote.id)) || quote.status
  const items = parseQuoteItemsRaw(quote.items)
  const customerRel = quote.customers
  const customer = (Array.isArray(customerRel) ? customerRel[0] : customerRel) as CustomerHit | null

  let serviceOrderHref: string | null = null
  if (quote.service_order_id) {
    const { data: os } = await supabase
      .from('service_orders')
      .select('id, display_number')
      .eq('id', quote.service_order_id)
      .maybeSingle()
    if (os) serviceOrderHref = getOrdemPortalPath(os)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <QuoteStatusBadge status={status} />
          {saved ? (
            <p className="text-sm text-muted-foreground">Salvo. Validade renovada por 7 dias.</p>
          ) : null}
        </div>
        <OrcamentoActionsMenu
          quoteId={quote.id}
          displayNumber={quote.display_number ?? quote.id}
          title={quote.title || 'Orçamento'}
          status={status}
          validUntil={quote.valid_until ? String(quote.valid_until).slice(0, 10) : null}
          totalCents={quote.items_total_cents ?? 0}
          shareToken={quote.share_token}
          customer={customer}
          serviceOrderHref={serviceOrderHref}
        />
      </div>

      <OrcamentoFormClient
        action={updateQuoteAction}
        quoteId={quote.id}
        heading={`Orçamento #${quote.display_number ?? ''}`}
        submitLabel="Salvar alterações"
        lockStatus={status === 'convertido'}
        initialError={error ? ERROR_MESSAGES[error] || error : undefined}
        initialCustomer={customer}
        initialValues={{
          customerId: quote.customer_id,
          title: quote.title || 'Orçamento',
          status,
          validUntil: quote.valid_until ? String(quote.valid_until).slice(0, 10) : '',
          notes: quote.notes || '',
          services: items.map(quoteItemToFormLine),
        }}
      />
    </div>
  )
}
