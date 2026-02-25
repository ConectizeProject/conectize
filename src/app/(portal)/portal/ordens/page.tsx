import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OrdensListClient } from './OrdensListClient'
import { OrdensToastClient } from './OrdensToastClient'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

const OPEN_STATUSES = ['orcamento', 'aguardando_aprovacao', 'aprovado', 'aguardando_pecas', 'em_manutencao', 'aguardando_retirada'] as const
const LIMIT_OPEN = 500

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function isValidOpenStatus(value: string): value is typeof OPEN_STATUSES[number] {
  return OPEN_STATUSES.includes(value as any)
}

type SearchParams = Promise<{ q?: string; cpf?: string; osNumber?: string; status?: string; toast?: string; id?: string; error?: string }>

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q, cpf, osNumber, status, toast, id, error } = await searchParams
  const query = String(q || '').trim()
  const cpfDigits = normalizeCpf(String(cpf || ''))
  const statusValue = String(status || '').trim()
  const osNumberValue = String(osNumber || '').trim()
  const toastType = String(toast || '').trim()
  const toastId = String(id || '').trim()
  const toastError = String(error || '').trim()

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  let customerIdsFilter: string[] | null = null
  if (cpfDigits) {
    const { data: custList } = await supabase
      .from('customers')
      .select('id')
      .or(`cpf.eq.${cpfDigits},cnpj.eq.${cpfDigits}`)
    customerIdsFilter = (custList || []).map((c: { id: string }) => c.id)
    if (customerIdsFilter.length === 0) {
      customerIdsFilter = []
    }
  }

  const baseQuery = supabase
    .from('service_orders')
    .select('id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id')
    .in('status', [...OPEN_STATUSES])
    .order('created_at', { ascending: false })
    .limit(LIMIT_OPEN)

  if (query) {
    const escaped = query.replaceAll(',', ' ').trim()
    baseQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  if (customerIdsFilter !== null) {
    if (customerIdsFilter.length === 0) {
      baseQuery.eq('customer_id', '00000000-0000-0000-0000-000000000000')
    } else {
      baseQuery.in('customer_id', customerIdsFilter)
    }
  }

  if (statusValue && isValidOpenStatus(statusValue)) {
    baseQuery.eq('status', statusValue)
  }

  if (osNumberValue) {
    const displayNum = Number.parseInt(osNumberValue, 10)
    if (!Number.isNaN(displayNum)) {
      baseQuery.eq('display_number', displayNum)
    }
  }

  const { data: rawOrders } = await baseQuery

  const ordersList = rawOrders || []
  const customerIds = [...new Set(ordersList.map((o: any) => o.customer_id).filter(Boolean))]
  const deviceModelIds = [...new Set(ordersList.map((o: any) => o.device_model_id).filter(Boolean))]

  let customersMap: Record<string, any> = {}
  let deviceModelsMap: Record<string, any> = {}

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, cpf, cnpj, is_company, full_name, company_name, email, mobile_phone')
      .in('id', customerIds)
    customersMap = (customers || []).reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = c
      return acc
    }, {})
  }

  if (deviceModelIds.length > 0) {
    const { data: deviceModels } = await supabase
      .from('device_models')
      .select('id, brand, device_type, model')
      .in('id', deviceModelIds)
    deviceModelsMap = (deviceModels || []).reduce((acc: Record<string, any>, d: any) => {
      acc[d.id] = d
      return acc
    }, {})
  }

  const ordersWithRelations = ordersList.map((o: any) => ({
    ...o,
    customers: o.customer_id ? customersMap[o.customer_id] ?? null : null,
    device_models: o.device_model_id ? deviceModelsMap[o.device_model_id] ?? null : null,
  }))

  const openOrdersByStatus: Record<string, typeof ordersWithRelations> = {}
  for (const s of OPEN_STATUSES) {
    openOrdersByStatus[s] = ordersWithRelations.filter((o: any) => o.status === s)
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
            Filtre por título/descrição, número da OS, CPF ou CNPJ do cliente, ou status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/ordens" method="get" className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="osNumber">Número da OS</Label>
              <Input
                id="osNumber"
                name="osNumber"
                inputMode="numeric"
                placeholder="Ex: 123"
                defaultValue={osNumberValue}
              />
            </div>
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
              <Label htmlFor="cpf">CPF ou CNPJ do cliente</Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="CPF (11 dígitos) ou CNPJ (14 dígitos)"
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
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
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

      <OrdensListClient
        openOrdersByStatus={openOrdersByStatus}
        filterQ={query}
        filterCpf={cpfDigits}
        filterOsNumber={osNumberValue}
        filterStatus={statusValue}
        canDelete={role === 'admin'}
      />
    </div>
  )
}

