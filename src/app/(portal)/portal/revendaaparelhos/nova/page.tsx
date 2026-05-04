import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { SeminovosFormClient } from '../../seminovos/SeminovosFormClient'

export default async function RevendaNovaPage () {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (
    normalizedRole !== 'staff' &&
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) redirect('/portal')

  return (
    <SeminovosFormClient
      isCreate
      defaultStockType="seminovo"
      backHref={revendaPath.seminovos}
      role={normalizedRole}
    />
  )
}
