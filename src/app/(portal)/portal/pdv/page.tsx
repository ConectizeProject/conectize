import { getPortalOrganizationId } from '@/lib/organizations/portal-organization-context'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { PdvClient } from './PdvClient'

export default async function PdvPage () {
  const { fullName, user } = await getPortalAuth()
  const sellerName = (fullName || user?.email || '').trim() || 'Vendedor'
  const supabase = await createSupabaseServerClient()
  const organizationId = user ? await getPortalOrganizationId(supabase, user.id) : null

  return (
    <PdvClient
      key={organizationId || 'no-org'}
      sellerName={sellerName}
    />
  )
}
