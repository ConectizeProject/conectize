import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ClienteDetailClient } from './ClienteDetailClient'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function ClienteDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone')
    .eq('id', id)
    .maybeSingle()

  if (error || !customer) notFound()

  const displayName = customer.is_company
    ? (customer.company_name || customer.trade_name || customer.full_name || 'Empresa')
    : (customer.full_name || 'Cliente')
  const document = formatCpfCnpj(String(customer.cnpj || customer.cpf || ''))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/clientes">← Clientes</Link>
          </Button>
          <h1 className="text-2xl font-bold mt-2">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{document}</p>
        </div>
      </div>

      <ClienteDetailClient
        customerId={customer.id}
        customerName={displayName}
      />
    </div>
  )
}
