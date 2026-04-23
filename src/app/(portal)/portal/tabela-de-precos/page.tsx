import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { TabelaPrecosLojistaClient } from './TabelaPrecosLojistaClient'

export const dynamic = 'force-dynamic'

export default async function TabelaPrecosLojistaPage () {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')
  if (
    normalizedRole === 'staff' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'platform_admin'
  ) {
    redirect('/portal/produtos?tab=precos')
  }
  if (normalizedRole !== 'retailer') redirect('/portal/minhas-ordens')

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tabela de preços</h1>
        <p className="text-sm text-muted-foreground">
          Visão comercial somente leitura: escolha um modelo de aparelho e consulte preços de lista e valores sugeridos por tag.
        </p>
      </div>
      <TabelaPrecosLojistaClient />
    </div>
  )
}
