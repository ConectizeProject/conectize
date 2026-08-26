'use server'

import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { parseServicesJson } from '@/lib/orders/order-form-parsers'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { defaultQuoteValidUntilYmd } from '@/lib/quotes/quote-dates'
import { getOrcamentoPortalPath } from '@/lib/quotes/quote-portal-path'
import { isManualQuoteStatus } from '@/lib/quotes/quote-status'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function updateQuoteAction (formData: FormData) {
  const quoteId = parseOptionalUuid(formData.get('quoteId'))
  if (!quoteId) redirect('/portal/orcamentos?error=invalido')

  const customerId = String(formData.get('customerId') || '').trim()
  const title = String(formData.get('title') || '').trim() || 'Orçamento'
  const statusRaw = String(formData.get('status') || '').trim()
  const notes = String(formData.get('notes') || '').trim()
  const services = parseServicesJson(formData.get('servicesJson'))

  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/orcamentos?error=sem_organizacao')

  const { data: existing } = await supabase
    .from('quotes')
    .select('id, display_number, status, customer_id')
    .eq('id', quoteId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!existing) redirect('/portal/orcamentos?error=nao_encontrado')

  const nextCustomerId = customerId || String(existing.customer_id)
  const { data: customerRow } = await supabase
    .from('customers')
    .select('id')
    .eq('id', nextCustomerId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!customerRow?.id) {
    redirect(`${getOrcamentoPortalPath(existing)}?error=cliente_invalido`)
  }

  const currentStatus = String(existing.status || '')
  let nextStatus = currentStatus
  if (currentStatus !== 'convertido' && isManualQuoteStatus(statusRaw)) {
    nextStatus = statusRaw
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      customer_id: nextCustomerId,
      title,
      status: nextStatus,
      notes: notes || null,
      valid_until: defaultQuoteValidUntilYmd(),
      items: services.items,
      items_total_cents: services.totalValueCents,
      items_cost_total_cents: services.totalCostCents,
    })
    .eq('id', quoteId)
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[quote-update]', error)
    redirect(`${getOrcamentoPortalPath(existing)}?error=nao_foi_possivel_salvar`)
  }

  redirect(`${getOrcamentoPortalPath(existing)}?saved=1`)
}
