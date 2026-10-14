import { hasBlingHubConnection } from '@/lib/integrations/bling/api'
import { getPortalOrganizationId } from '@/lib/organizations/portal-organization-context'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { PdvClient } from './PdvClient'

export default async function PdvPage () {
  const { fullName, user } = await getPortalAuth()
  const sellerName = (fullName || user?.email || '').trim() || 'Vendedor'
  const supabase = await createSupabaseServerClient()
  const organizationId = user ? await getPortalOrganizationId(supabase, user.id) : null
  const hasBlingIntegration = organizationId
    ? await hasBlingHubConnection(supabase)
    : false

  return (
    <PdvClient
      key={organizationId || 'no-org'}
      sellerName={sellerName}
      organizationId={organizationId}
      hasBlingIntegration={hasBlingIntegration}
    />
  )
}
