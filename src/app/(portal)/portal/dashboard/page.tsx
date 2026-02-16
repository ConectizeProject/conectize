import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/orders'
import { formatDateTimeBr } from '@/lib/utils/format-date'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) redirect('/portal/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const openStatuses = [
    'orcamento',
    'aprovado',
    'aguardando_pecas',
    'em_manutencao',
    'aguardando_retirada',
  ]

  const [{ count: openOrdersCount }, { count: customersCount }, { data: latestOrders }] = await Promise.all([
    supabase
      .from('service_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', openStatuses),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('service_orders')
      .select('id, display_number, status, title, created_at, customers ( full_name, company_name, is_company )')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumo rápido do portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/portal/ordens/nova">Nova ordem</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/portal/ordens">Ver ordens</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ordens abertas</CardTitle>
            <CardDescription>Precisam de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openOrdersCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes cadastrados</CardTitle>
            <CardDescription>Na base de contatos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customersCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atalhos</CardTitle>
            <CardDescription>Ações rápidas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="secondary" asChild className="justify-start">
              <Link href="/portal/clientes">Buscar clientes</Link>
            </Button>
            <Button variant="secondary" asChild className="justify-start">
              <Link href="/portal/admin/usuarios">Gerenciar usuários</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas ordens</CardTitle>
          <CardDescription>Mais recentes cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          {latestOrders && latestOrders.length > 0 ? (
            <div className="space-y-3">
              {latestOrders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-[220px]">
                    <Link href={`/portal/ordens/${order.id}`} className="font-medium hover:underline">
                      OS #{order.display_number ?? order.id} — {order.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {order.customers?.is_company
                        ? (order.customers?.company_name || 'Empresa')
                        : (order.customers?.full_name || 'Cliente')} • {formatDateTimeBr(order.created_at)}
                    </div>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhuma ordem encontrada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

