import { redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { FinanceiroSubmenu } from './FinanceiroSubmenu'

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')
  if (role !== 'admin') redirect('/portal/ordens')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Entradas, saídas e saldos por conta. Apenas administradores.
        </p>
      </div>

      <FinanceiroSubmenu />

      {children}
    </div>
  )
}
