import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { OrderStatusBadge } from '@/components/orders'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function MinhasOrdensPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()

  //todo: deve ser feito de forma mais segura, com middleware, em um contxto mais global, contemplando todas as rotas protegidas
  if (!user) redirect('/portal/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('role, cpf')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'

  const { data: customer } = await supabase
    .from('customers')
    .select('id, cpf, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const effectiveCpf = customer?.cpf || appUser?.cpf || null

  if (role === 'user' && !effectiveCpf) {
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

  const { data: orders } = await supabase
    .from('service_orders')
    .select('id, display_number, status, title, created_at, updated_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas ordens de serviço</h1>
        <p className="text-sm text-muted-foreground">
          {customer?.full_name ? customer.full_name : 'Cliente'} • CPF {effectiveCpf ? formatCpfCnpj(effectiveCpf) : '-'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens</CardTitle>
          <CardDescription>
            Aqui aparecem as ordens vinculadas ao seu CPF.
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
                      <Link href={`/portal/ordens/${order.id}`} className="block hover:underline focus:underline outline-none">
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
              <p className="text-sm text-muted-foreground/80 mt-1.5 max-w-xs text-center">Suas ordens de serviço aparecerão aqui quando forem vinculadas ao seu CPF.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


