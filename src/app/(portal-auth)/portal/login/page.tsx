import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { getAuthUser } from '@/lib/supabase/server'
import { LoginClient } from './LoginClient'

type SearchParams = Promise<{ redirectTo?: string }>

export default async function PortalLoginPage ({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getAuthUser()
  const { redirectTo } = await searchParams

  if (user) {
    redirect(assertSafePortalPath(redirectTo))
  }

  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient />
    </Suspense>
  )
}

