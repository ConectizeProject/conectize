import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getSupabasePlatformStatus } from '@/lib/supabase/platform-status'
import {
  createSupabaseServerClient,
  getPortalAuth,
} from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
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
  const [{ user, role, fullName }, supabasePlatformStatus] = await Promise.all([
    getPortalAuth(),
    getSupabasePlatformStatus(),
  ])
  if (!user) {
    await redirectToPortalLogin()
  }

  let platformOrganizations = null as
    | Array<{ id: string; slug: string; name: string | null; is_host: boolean }>
    | null
  let activeOrganizationId: string | null = null

  if (role === 'platform_admin') {
    const supabase = await createSupabaseServerClient()
    await ensurePortalOrganizationContext(supabase, user.id)
    activeOrganizationId = await getPortalOrganizationId(supabase, user.id)
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
        userEmail={user.email || ''}
        userName={fullName}
        supabasePlatformStatus={supabasePlatformStatus}
        platformOrganizations={platformOrganizations}
        activeOrganizationId={activeOrganizationId}
      >
        {children}
      </PortalShell>
    </RouteProviders>
  )
}

