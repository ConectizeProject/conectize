import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { LoginClient } from './LoginClient'

type SearchParams = Promise<{ redirectTo?: string }>

export default async function PortalLoginPage ({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getAuthUser()
  const { redirectTo } = await searchParams

  if (user) {
    const safeRedirect = typeof redirectTo === 'string' && redirectTo.startsWith('/portal')
      ? redirectTo
      : '/portal'
    redirect(safeRedirect)
  }

  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient />
    </Suspense>
  )
}

