import Link from 'next/link'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { resolvePortalCustomer } from '@/lib/portal/resolve-portal-customer'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { OrderStatusBadge } from '@/components/orders'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function MinhasOrdensPage() {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getPortalAuth()

  if (!user) await redirectToPortalLogin()

  await ensurePortalOrganizationContext(supabase, user.id)

  const { data: appUser } = await supabase
    .from('users')
    .select('role, cpf')
    .eq('id', user.id)
    .maybeSingle()

  const normalizedRole = role === 'customer' ? 'user' : role

  const { customer, effectiveTaxId, source } = await resolvePortalCustomer(supabase, user.id)

  if (normalizedRole === 'retailer' && source === 'none') {
    await ensurePortalOrganizationContext(supabase, user.id)
    const activeOrgId = await getPortalOrganizationId(supabase, user.id)
    let adminOrgLabel: string | null = null
    if (activeOrgId) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', activeOrgId)
        .maybeSingle()
      adminOrgLabel = orgRow?.name ? String(orgRow.name).trim() || null : null
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">
            Conta lojista sem vínculo a uma loja.
          </p>
        </div>
        <Alert>
          <AlertTitle>Vínculo pendente</AlertTitle>
          <AlertDescription>
            {adminOrgLabel
              ? `Peça ao administrador de ${adminOrgLabel} para vincular seu usuário ao cadastro da sua loja.`
              : 'Peça ao administrador da sua empresa para vincular seu usuário ao cadastro da sua loja.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const effectiveCpf = customer?.cpf || appUser?.cpf || null

  if (normalizedRole === 'user' && !effectiveCpf) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">
            Para visualizar suas ordens, complete seus dados.
          </p>
        </div>

        <Alert>
          <AlertTitle>Complete seu cadastro</AlertTitle>
          <AlertDescription>
            Para acessar suas ordens, informe seu CPF na tela de dados.
          </AlertDescription>
        </Alert>

        <Link href="/portal/complete-profile" className="underline text-sm text-primary">
          Ir para meus dados
        </Link>
      </div>
    )
  }

  const { data: orders } = customer?.id
    ? await supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, updated_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
    : await supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, updated_at')
      .order('created_at', { ascending: false })

  const displayLabel =
    customer?.company_name ||
    customer?.trade_name ||
    customer?.full_name ||
    'Cliente'

  const docLabel =
    customer?.is_company ? 'CNPJ' : 'CPF'

  const docFormatted = effectiveTaxId ? formatCpfCnpj(effectiveTaxId) : '-'

  const isRetailer = normalizedRole === 'retailer'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas ordens de serviço</h1>
        <p className="text-sm text-muted-foreground">
          {displayLabel} • {docLabel} {docFormatted}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens</CardTitle>
          <CardDescription>
            {isRetailer
              ? 'Ordens de serviço da sua loja.'
              : 'Aqui aparecem as ordens vinculadas ao seu CPF.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Atualizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link href={getOrdemPortalPath(order)} transitionTypes={['nav-forward']} className="block hover:underline focus:underline outline-none">
                        #{order.display_number ?? order.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="font-medium">{order.title}</TableCell>
                    <TableCell>{formatDateTimeBr(order.created_at)}</TableCell>
                    <TableCell>{formatDateTimeBr(order.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <img src="/empty-ordens.svg" alt="" className="w-36 h-36 mx-auto mb-5 object-contain" aria-hidden />
              <p className="text-base font-medium text-muted-foreground">Nenhuma OS encontrada</p>
              <p className="text-sm text-muted-foreground/80 mt-1.5 max-w-xs text-center">
                {isRetailer
                  ? 'As ordens da loja aparecerão aqui quando forem cadastradas.'
                  : 'Suas ordens de serviço aparecerão aqui quando forem vinculadas ao seu CPF.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
