import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { SeminovosFormClient } from '../SeminovosFormClient'

type SearchParams = Promise<{ tipo?: string }>

export default async function SeminovosNovaPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const params = await searchParams
  const defaultStockType =
    String(params?.tipo || '').toLowerCase() === 'lacrados' ? 'lacrado' : 'seminovo'
  const backHref =
    defaultStockType === 'lacrado' ? '/portal/seminovos?tipo=lacrados' : '/portal/seminovos'

  return (
    <SeminovosFormClient
      isCreate
      defaultStockType={defaultStockType}
      backHref={backHref}
    />
  )
}
