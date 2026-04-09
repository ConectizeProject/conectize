import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { logPortalRedirect } from '@/lib/auth/portal-redirect-log'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { getAuthUser } from '@/lib/supabase/server'
import { LoginClient } from './LoginClient'

type SearchParams = Promise<{ redirectTo?: string }>

export default async function PortalLoginPage ({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getAuthUser()
  const { redirectTo } = await searchParams
  const resolvedReturnPath = assertSafePortalPath(redirectTo)

  logPortalRedirect('loginPage(server)', {
    redirectToQuery: redirectTo ?? '(sem query)',
    resolvedReturnPath,
    hasSession: Boolean(user),
  })

  if (user) {
    redirect(resolvedReturnPath)
  }

  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient fallbackReturnPath={resolvedReturnPath} />
    </Suspense>
  )
}

