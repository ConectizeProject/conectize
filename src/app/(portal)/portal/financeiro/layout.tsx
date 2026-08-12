import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { FinanceiroSubmenu } from './FinanceiroSubmenu'

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  if (role !== 'admin' && role !== 'platform_admin') redirect('/portal/ordens')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Entradas, saídas, comissões e saldos por conta. Apenas administradores.
        </p>
      </div>

      <FinanceiroSubmenu />

      {children}
    </div>
  )
}
