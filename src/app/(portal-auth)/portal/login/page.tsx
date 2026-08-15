import { Suspense } from 'react'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { getSupabasePlatformStatus } from '@/lib/supabase/platform-status'
import { LoginClient } from './LoginClient'

type SearchParams = Promise<{ redirectTo?: string }>

/**
 * Sem getAuthUser no servidor: evita várias chamadas ao Supabase (getClaims + getUser)
 * quando o DNS/rede falha e impede o HTML de chegar. Quem já está logado é tratado no cliente.
 */
export default async function PortalLoginPage ({ searchParams }: { searchParams: SearchParams }) {
  const { redirectTo } = await searchParams
  const resolvedReturnPath = assertSafePortalPath(redirectTo)
  const supabasePlatformStatus = await getSupabasePlatformStatus()

  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient
        fallbackReturnPath={resolvedReturnPath}
        supabasePlatformStatus={supabasePlatformStatus}
      />
    </Suspense>
  )
}
