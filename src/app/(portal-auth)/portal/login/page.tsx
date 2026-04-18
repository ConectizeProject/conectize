import { Suspense } from 'react'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { LoginClient } from './LoginClient'

type SearchParams = Promise<{ redirectTo?: string }>

/**
 * Sem getAuthUser no servidor: evita várias chamadas ao Supabase (getClaims + getUser)
 * quando o DNS/rede falha e impede o HTML de chegar. Quem já está logado é tratado no cliente.
 */
export default async function PortalLoginPage ({ searchParams }: { searchParams: SearchParams }) {
  const { redirectTo } = await searchParams
  const resolvedReturnPath = assertSafePortalPath(redirectTo)

  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient fallbackReturnPath={resolvedReturnPath} />
    </Suspense>
  )
}
