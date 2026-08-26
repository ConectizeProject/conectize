'use server'

import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { parseServicesJson } from '@/lib/orders/order-form-parsers'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { defaultQuoteValidUntilYmd, isValidYmd } from '@/lib/quotes/quote-dates'
import { getOrcamentoPortalPath } from '@/lib/quotes/quote-portal-path'
import { isManualQuoteStatus } from '@/lib/quotes/quote-status'

function normalizeDocument (value: string) {
  return value.replace(/\D/g, '').trim()
}

export async function createQuoteAction (formData: FormData) {
  const document = normalizeDocument(String(formData.get('document') || formData.get('cpf') || ''))
  const customerId = String(formData.get('customerId') || '').trim()
  const title = String(formData.get('title') || '').trim() || 'Orçamento'
  const statusRaw = String(formData.get('status') || 'rascunho').trim()
  const status = isManualQuoteStatus(statusRaw) ? statusRaw : 'rascunho'
  const notes = String(formData.get('notes') || '').trim()
  const validUntilRaw = String(formData.get('validUntil') || '').trim()
  const validUntil = isValidYmd(validUntilRaw) ? validUntilRaw : defaultQuoteValidUntilYmd()
  const services = parseServicesJson(formData.get('servicesJson'))

  if (!document || (document.length !== 11 && document.length !== 14)) {
    redirect(`/portal/orcamentos/novo?error=${document && document.length > 11 ? 'cnpj_invalido' : 'cpf_invalido'}`)
  }
  if (!customerId) redirect('/portal/orcamentos/novo?error=customer_obrigatorio')

  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/orcamentos/novo?error=sem_organizacao')

  const { data: customerRow } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!customerRow?.id) redirect('/portal/orcamentos/novo?error=cliente_invalido')

  const { data: inserted, error } = await supabase
    .from('quotes')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      title,
      status,
      notes: notes || null,
      valid_until: validUntil,
      items: services.items,
      items_total_cents: services.totalValueCents,
      items_cost_total_cents: services.totalCostCents,
      created_by: user.id,
    })
    .select('id, display_number')
    .single()

  if (error || !inserted) {
    const message = String(error?.message || '').trim()
    const code = String(error?.code || '').trim()
    console.warn(`[quote-create] ${code} ${message}`.trim())
    redirect('/portal/orcamentos/novo?error=nao_foi_possivel_criar')
  }

  redirect(getOrcamentoPortalPath(inserted))
}
