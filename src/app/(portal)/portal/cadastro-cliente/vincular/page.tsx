import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function VincularCadastroClientePage ({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ref_os?: string }>
}) {
  const sp = await searchParams
  const orgSlug = String(sp.org || '').trim().toLowerCase()
  const refOs = String(sp.ref_os || '').trim()

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

  await svc.from('organization_members').upsert(
    {
      organization_id: organizationId,
      user_id: user.id,
      role_in_org: 'user',
    },
    { onConflict: 'organization_id,user_id' },
  )

  await svc.from('user_portal_context').upsert({
    user_id: user.id,
    active_organization_id: organizationId,
  })

  if (orderRow.customer_id) {
    const customerId = String(orderRow.customer_id)
    const { data: customer } = await svc
      .from('customers')
      .select('id, auth_user_id')
      .eq('id', customerId)
      .maybeSingle()

    const currentAuth = customer?.auth_user_id ? String(customer.auth_user_id) : null
    if (!currentAuth || currentAuth === user.id) {
      await svc
        .from('customers')
        .update({ auth_user_id: user.id })
        .eq('id', customerId)
    }
  }

  redirect('/portal/complete-profile')
}
