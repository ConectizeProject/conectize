import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import {
  enrichOrderFinance,
  filterOrdersForFinanceList,
  sumOpenCents,
  type OrderFinanceInput,
} from '@/lib/portal/retailer-finance-helpers'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { formatCentsBr } from '@/lib/utils/format-money'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function FinanceiroLojistaPage () {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole === 'staff') redirect('/portal/ordens')
  if (normalizedRole === 'admin' || normalizedRole === 'platform_admin') {
    redirect('/portal/financeiro')
  }
  if (normalizedRole !== 'retailer') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  const { data: rows, error } = await supabase
    .from('service_orders')
    .select(
      'id, display_number, status, services_total_cents, services_cost_total_cents, payment_methods, updated_at, closed_at',
    )
    .order('closed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Não foi possível carregar as ordens.</p>
      </div>
    )
  }

  const listRaw = (rows ?? []) as OrderFinanceInput[]
  const finalized = filterOrdersForFinanceList(listRaw)
  const enriched = finalized.map(enrichOrderFinance)
  const totalAberto = sumOpenCents(enriched)
  const pendentes = enriched.filter((r) => r.financeLabel === 'pendente').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Ordens finalizadas: valores cobrados, pagamentos registrados e custo da manutenção.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total em aberto</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCentsBr(totalAberto)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS com pagamento pendente</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{pendentes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS na lista (finalizadas)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{enriched.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens</CardTitle>
          <CardDescription>
            Soma do pago considera <code className="text-xs">value_cents</code> em cada forma de
            pagamento. Em aberto = valor da OS menos o pago.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {enriched.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ordem finalizada encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor serviço</TableHead>
                  <TableHead className="text-right">Custo OS</TableHead>
                  <TableHead className="text-right">Valor pago</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/portal/ordens/${o.display_number ?? o.id}`}
                        className="hover:underline"
                      >
                        #{o.display_number ?? o.id}
                      </Link>
                    </TableCell>
                    <TableCell>{getOrderStatusLabel(o.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsBr(o.services_total_cents ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsBr(o.services_cost_total_cents ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsBr(o.valorPagoCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsBr(o.valorEmAbertoCents)}
                    </TableCell>
                    <TableCell>
                      {o.financeLabel === 'pago' ? (
                        <Badge variant="secondary">Pago</Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
