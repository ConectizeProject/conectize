import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/orders'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OrdensTableRow } from './OrdensTableRow'
import { OrdensToastClient } from './OrdensToastClient'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'

const pageSize = 20

function parsePage(value?: string) {
  const parsed = Number.parseInt(value || '1', 10)
  if (Number.isNaN(parsed) || parsed < 1) return 1
  return parsed
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function isValidStatus(value: string) {
  return value === 'orcamento' ||
    value === 'aprovado' ||
    value === 'aguardando_pecas' ||
    value === 'em_manutencao' ||
    value === 'aguardando_retirada' ||
    value === 'finalizada' ||
    value === 'finalizada_sem_conserto' ||
    value === 'finalizada_sem_aprovacao' ||
    value === 'cancelada'
}

type SearchParams = Promise<{ page?: string; q?: string; cpf?: string; status?: string; toast?: string; id?: string; error?: string }>

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { page, q, cpf, status, toast, id, error } = await searchParams
  const currentPage = parsePage(page)
  const query = String(q || '').trim()
  const cpfDigits = normalizeCpf(String(cpf || ''))
  const statusValue = String(status || '').trim()
  const toastType = String(toast || '').trim()
  const toastId = String(id || '').trim()
  const toastError = String(error || '').trim()

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  const baseQuery = supabase
    .from('service_orders')
    .select('id, display_number, status, title, created_at, updated_at, estimated_ready_at, share_token, customers ( cpf, cnpj, is_company, full_name, company_name, email, mobile_phone ), device_models ( brand, device_type, model )', { count: 'planned' })
    .order('created_at', { ascending: false })

  if (query) {
    const escaped = query.replaceAll(',', ' ')
    baseQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  if (cpfDigits) {
    baseQuery.or(`customers.cpf.eq.${cpfDigits},customers.cnpj.eq.${cpfDigits}`)
  }

  if (statusValue && isValidStatus(statusValue)) {
    baseQuery.eq('status', statusValue)
  }

  const { data: orders, count } = await baseQuery.range(from, to)

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  if (safePage !== currentPage) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (cpfDigits) params.set('cpf', cpfDigits)
    if (statusValue) params.set('status', statusValue)
    if (toastType) params.set('toast', toastType)
    if (toastId) params.set('id', toastId)
    if (toastError) params.set('error', toastError)
    params.set('page', String(safePage))
    redirect(`/portal/ordens?${params.toString()}`)
  }

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (cpfDigits) params.set('cpf', cpfDigits)
    if (statusValue) params.set('status', statusValue)
    if (toastType) params.set('toast', toastType)
    if (toastId) params.set('id', toastId)
    if (toastError) params.set('error', toastError)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `/portal/ordens?${qs}` : '/portal/ordens'
  }

  return (
    <div className="space-y-6">
      <OrdensToastClient />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">
            Área interna (staff/admin).
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/ordens/nova">Nova ordem</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
          <CardDescription>
            Filtre por título/descrição, CPF/CNPJ ou status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/ordens" method="get" className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="q">Busca</Label>
              <Input
                id="q"
                name="q"
                placeholder="Ex: troca de tela, iPhone..."
                defaultValue={query}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF/CNPJ</Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="Ex: 000.000.000-00"
                defaultValue={cpfDigits ? formatCpfCnpj(cpfDigits) : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={statusValue}
              >
                <option value="">Todos</option>
                <option value="orcamento">Orçamento</option>
                <option value="aprovado">Aprovado</option>
                <option value="aguardando_pecas">Aguardando peças</option>
                <option value="em_manutencao">Em manutenção</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
                <option value="finalizada">Finalizada</option>
                <option value="finalizada_sem_conserto">Finalizada sem conserto</option>
                <option value="finalizada_sem_aprovacao">Finalizada sem aprovação</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div className="md:col-span-4 flex items-center gap-3 flex-wrap">
              <Button type="submit">Buscar</Button>
              <Button variant="outline" asChild>
                <Link href="/portal/ordens">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {total > 0 ? `${total} ordens • Página ${safePage} de ${totalPages}` : 'Últimas ordens cadastradas.'}
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Estimativa</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <OrdensTableRow key={order.id} order={order} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <img src="/empty-ordens.svg" alt="" className="w-36 h-36 mx-auto mb-5 object-contain" aria-hidden />
              <p className="text-base font-medium text-muted-foreground">Nenhuma ordem encontrada</p>
              <p className="text-sm text-muted-foreground/80 mt-1.5 max-w-xs text-center">Cadastre uma nova ordem ou ajuste os filtros da busca.</p>
              <Button asChild className="mt-4">
                <Link href="/portal/ordens/nova">Nova ordem</Link>
              </Button>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                asChild={safePage > 1}
              >
                {safePage > 1
                  ? <Link href={buildPageHref(safePage - 1)}>Anterior</Link>
                  : <span>Anterior</span>}
              </Button>

              <div className="text-sm text-muted-foreground">
                Página {safePage} de {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                asChild={safePage < totalPages}
              >
                {safePage < totalPages
                  ? <Link href={buildPageHref(safePage + 1)}>Próxima</Link>
                  : <span>Próxima</span>}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

