import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getSupabasePlatformStatus } from '@/lib/supabase/platform-status'
import {
  createSupabaseServerClient,
  getPortalAuth,
} from '@/lib/supabase/server'
import { getPortalOrganizationId } from '@/lib/organizations/portal-organization-context'
import { RouteProviders } from '@/providers/route-providers'
import { PortalShell } from './PortalShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ user, role, realRole, simulatedRole, fullName }, supabasePlatformStatus] = await Promise.all([
    getPortalAuth(),
    getSupabasePlatformStatus(),
  ])
  if (!user) {
    await redirectToPortalLogin()
  }

  const supabase = await createSupabaseServerClient()
  const activeOrganizationId = await getPortalOrganizationId(supabase, user.id)
  let organizationDisplayName: string | null = null
  let hasWhatsappIntegration = false
  if (activeOrganizationId) {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', activeOrganizationId)
      .maybeSingle()
    organizationDisplayName = orgRow?.name ? String(orgRow.name).trim() || null : null

    const { data: whatsappConn } = await supabase
      .from('hub_connections')
      .select('id')
      .eq('organization_id', activeOrganizationId)
      .eq('platform_id', 'whatsapp_business')
      .limit(1)
      .maybeSingle()
    hasWhatsappIntegration = Boolean(whatsappConn?.id)
  }

  let platformOrganizations = null as
    | Array<{ id: string; slug: string; name: string | null; is_host: boolean }>
    | null

  if (realRole === 'platform_admin') {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, slug, name, is_host')
      .order('name', { ascending: true })
    platformOrganizations = orgs ?? []
  }

  return (
    <RouteProviders>
      <PortalShell
        role={role}
        realRole={realRole}
        simulatedRole={simulatedRole}
        userEmail={user.email || ''}
        userName={fullName}
        organizationName={organizationDisplayName}
        hasWhatsappIntegration={hasWhatsappIntegration}
        supabasePlatformStatus={supabasePlatformStatus}
        platformOrganizations={platformOrganizations}
        activeOrganizationId={activeOrganizationId}
      >
        {children}
      </PortalShell>
    </RouteProviders>
  )
}

