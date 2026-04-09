import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
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
  const { user, role, fullName } = await getPortalAuth()
  if (!user) {
    await redirectToPortalLogin()
  }

  return (
    <PortalShell
      role={role}
      userEmail={user.email || ''}
      userName={fullName}
    >
      {children}
    </PortalShell>
  )
}

