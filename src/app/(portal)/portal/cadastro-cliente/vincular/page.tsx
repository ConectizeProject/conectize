import { redirect } from 'next/navigation'
import { shouldClaimCustomerFromOsRegistration } from '@/lib/auth/cadastro-cliente-claim'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { stripAutoHostOrganizationMembership } from '@/lib/organizations/strip-auto-host-membership'
import { getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { onlyDigits } from '@/lib/utils/strings'

export const dynamic = 'force-dynamic'

export default async function VincularCadastroClientePage ({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ref_os?: string; document?: string }>
}) {
  const sp = await searchParams
  const orgSlug = String(sp.org || '').trim().toLowerCase()
  const refOs = String(sp.ref_os || '').trim()
  const submittedDocument = onlyDigits(String(sp.document || '')).slice(0, 14)

  if (!orgSlug || !refOs) {
    redirect('/portal/complete-profile?error=os_invalida')
  }

  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  let svc
  try {
    svc = createSupabaseServiceClient()
  } catch {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=config`)
  }

  const { data: orderRow } = await svc
    .from('service_orders')
    .select('id, organization_id, customer_id')
    .eq('share_token', refOs)
    .maybeSingle()

  if (!orderRow?.organization_id) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=os_invalida`)
  }

  const { data: orgRow } = await svc
    .from('organizations')
    .select('id, slug')
    .eq('id', orderRow.organization_id)
    .maybeSingle()

  if (String(orgRow?.slug || '').toLowerCase() !== orgSlug) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=os_invalida`)
  }

  const organizationId = String(orderRow.organization_id)
  const orderCustomerId = orderRow.customer_id ? String(orderRow.customer_id) : null
  let orderCustomer: {
    id: string
    auth_user_id?: string | null
    cpf?: string | null
    cnpj?: string | null
  } | null = null

  if (orderCustomerId) {
    const { data: customer } = await svc
      .from('customers')
      .select('id, auth_user_id, cpf, cnpj')
      .eq('id', orderCustomerId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    orderCustomer = customer
    const currentAuth = customer?.auth_user_id ? String(customer.auth_user_id) : null

    // Share token alone must not bind an unclaimed customer. Same proof as the
    // email/password cadastro action: CPF/CNPJ of the OS customer.
    if (!currentAuth) {
      if (!shouldClaimCustomerFromOsRegistration({
        orderCustomerId,
        customer,
        submittedDocumentDigits: submittedDocument,
      })) {
        redirect(
          `/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=documento_nao_confere`,
        )
      }
    } else if (currentAuth !== user.id) {
      redirect(
        `/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=cliente_ja_vinculado`,
      )
    }
  }

  const { error: memberErr } = await svc.from('organization_members').upsert(
    {
      organization_id: organizationId,
      user_id: user.id,
      role_in_org: 'user',
    },
    { onConflict: 'organization_id,user_id' },
  )

  if (memberErr) {
    redirect('/portal/complete-profile?error=vinculo_falhou')
  }

  const stripErr = await stripAutoHostOrganizationMembership(svc, user.id)
  if (stripErr) {
    redirect('/portal/complete-profile?error=vinculo_falhou')
  }

  const { error: portalErr } = await svc.from('user_portal_context').upsert({
    user_id: user.id,
    active_organization_id: organizationId,
  })

  if (portalErr) {
    redirect('/portal/complete-profile?error=vinculo_falhou')
  }

  if (
    orderCustomerId &&
    shouldClaimCustomerFromOsRegistration({
      orderCustomerId,
      customer: orderCustomer,
      submittedDocumentDigits: submittedDocument,
    })
  ) {
    await svc
      .from('customers')
      .update({ auth_user_id: user.id })
      .eq('id', orderCustomerId)
      .eq('organization_id', organizationId)
      .is('auth_user_id', null)
  }

  redirect('/portal/complete-profile')
}
