import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { FormasPagamentoClient } from '@/app/(portal)/portal/admin/dados-empresa/formas-pagamento/FormasPagamentoClient'

export default async function FormasPagamentoPage () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin' && me?.role !== 'platform_admin') redirect('/portal/ordens')

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) {
    return <FormasPagamentoClient initialPaymentMethods={[]} />
  }

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })

  return (
    <FormasPagamentoClient
      initialPaymentMethods={(paymentMethods ?? []).map((pm) => ({
        id: pm.id,
        description: pm.description ?? '',
        type: pm.type ?? 'dinheiro',
        fee_percent: Number(pm.fee_percent ?? 0),
        credit_installment_fees: Array.isArray(pm.credit_installment_fees)
          ? pm.credit_installment_fees
          : [],
        sort_order: pm.sort_order ?? 0,
        conta_id: (pm as { conta_id?: string | null }).conta_id ?? null,
      }))}
    />
  )
}
