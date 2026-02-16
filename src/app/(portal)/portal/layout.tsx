import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    redirect('/portal/login?redirectTo=/portal')
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'

  return (
    <PortalShell
      role={role}
      userEmail={user.email || ''}
      userName={String(appUser?.full_name || '').trim()}
    >
      {children}
    </PortalShell>
  )
}

