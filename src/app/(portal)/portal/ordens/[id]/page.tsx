import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { OrderCustomerCard } from './OrderCustomerCard'
import { OrderPasscodeFields } from './OrderPasscodeFields'
import { OrdemDetalheToastClient } from './OrdemDetalheToastClient'
import { OrdemPrintButton } from './OrdemPrintButton'
import { OrdemShareButtons } from './OrdemShareButtons'
import { UpdateOrderSubmitButton } from './UpdateOrderSubmitButton'

export const dynamic = 'force-dynamic'

function formatStatus(status: string) {
  if (status === 'orcamento') return 'Orçamento'
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'aguardando_pecas') return 'Aguardando peças'
  if (status === 'em_manutencao') return 'Em manutenção'
  if (status === 'aguardando_retirada') return 'Aguardando retirada'
  if (status === 'finalizada') return 'Finalizada'
  if (status === 'finalizada_sem_conserto') return 'Finalizada sem conserto'
  if (status === 'finalizada_sem_aprovacao') return 'Finalizada sem aprovação'
  if (status === 'cancelada') return 'Cancelada'
  return status
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

function getCustomerFromOrder(order: any) {
  const customer = order?.customers
  if (Array.isArray(customer)) return customer[0] || null
  return customer || null
}

function getDeviceModelFromOrder(order: any) {
  const deviceModel = order?.device_models
  if (Array.isArray(deviceModel)) return deviceModel[0] || null
  return deviceModel || null
}

function formatDateTimeLocal(value: any) {
  if (!value) return ''
  const dt = new Date(String(value))
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = dt.getFullYear()
  const m = pad(dt.getMonth() + 1)
  const d = pad(dt.getDate())
  const h = pad(dt.getHours())
  const min = pad(dt.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function OrdemDetalhePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { error } = await searchParams

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

  const [{ data: order }, { data: companySettings }] = await Promise.all([
    supabase
      .from('service_orders')
      .select('id, display_number, status, title, imei, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, customer_description, internal_description, receiving_notes, assistance_info, device_model_id, brand, model, created_at, updated_at, share_token, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date, zip_code, state, city, neighborhood, street, street_number, street_complement, referral_source, referral_source_other ), device_models ( brand, device_type, model )')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url').eq('id', 1).maybeSingle(),
  ])

  if (!order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ordem não encontrada</CardTitle>
          <CardDescription>Verifique o ID e tente novamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/portal/ordens">Voltar</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  function formatBirthDate(value: string | null | undefined) {
    if (!value) return null
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleDateString('pt-BR')
  }

  const customer = getCustomerFromOrder(order)
  const deviceModel = getDeviceModelFromOrder(order)

  async function updateOrderAction(formData: FormData) {
    'use server'

    const orderId = String(formData.get('orderId') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const status = String(formData.get('status') || '').trim()
    const imei = String(formData.get('imei') || '').trim()
    const isWarranty = Boolean(formData.get('isWarranty'))
    const estimatedReadyAtRaw = String(formData.get('estimatedReadyAt') || '').trim()
    const passcodeType = String(formData.get('passcodeType') || '').trim()
    const passcodeText = String(formData.get('passcodeText') || '').trim()
    const passcodePattern = String(formData.get('passcodePattern') || '').trim()
    const customerDescription = String(formData.get('customerDescription') || '').trim()
    const internalDescription = String(formData.get('internalDescription') || '').trim()
    const receivingNotes = String(formData.get('receivingNotes') || '').trim()
    const assistanceInfo = String(formData.get('assistanceInfo') || '').trim()

    const estimatedReadyAt = (() => {
      if (!estimatedReadyAtRaw) return null
      const dt = new Date(estimatedReadyAtRaw)
      if (Number.isNaN(dt.getTime())) return null
      return dt.toISOString()
    })()

    if (!orderId) redirect(`/portal/ordens/${id}?error=dados_invalidos`)
    if (!title) redirect(`/portal/ordens/${id}?error=titulo_obrigatorio`)
    if (!isValidStatus(status)) redirect(`/portal/ordens/${id}?error=status_invalido`)

    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) redirect('/portal/login')

    const { data: appUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = appUser?.role || 'user'
    const normalizedRole = role === 'customer' ? 'user' : role
    if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

    const { error } = await supabase
      .from('service_orders')
      .update({
        title,
        status,
        imei: imei || null,
        is_warranty: isWarranty,
        estimated_ready_at: estimatedReadyAt,
        passcode_type: (passcodeType === 'text' || passcodeType === 'pattern') ? passcodeType : null,
        passcode_text: passcodeType === 'text' ? (passcodeText || null) : null,
        passcode_pattern: passcodeType === 'pattern' ? (passcodePattern || null) : null,
        customer_description: customerDescription || null,
        internal_description: internalDescription || null,
        receiving_notes: receivingNotes || null,
        assistance_info: assistanceInfo || null,
      })
      .eq('id', orderId)

    if (error) redirect(`/portal/ordens/${id}?error=nao_foi_possivel_salvar`)

    redirect(`/portal/ordens/${id}?ok=1`)
  }

  async function deleteOrderAction(formData: FormData) {
    'use server'

    const orderId = String(formData.get('orderId') || '').trim()
    if (!orderId) redirect('/portal/ordens?error=dados_invalidos')

    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) redirect('/portal/login')

    const { data: appUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = appUser?.role || 'user'
    const normalizedRole = role === 'customer' ? 'user' : role
    if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

    const { error } = await supabase
      .from('service_orders')
      .delete()
      .eq('id', orderId)

    if (error) redirect(`/portal/ordens/${id}?error=nao_foi_possivel_excluir`)

    redirect('/portal/ordens?ok=1')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <OrdemDetalheToastClient />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ordem de serviço {order.display_number ?? order.id}</h1>
          <p className="text-sm text-muted-foreground">
            {customer?.is_company
              ? customer?.company_name
              : customer?.full_name} • {customer?.cnpj ? `CNPJ ${customer.cnpj}` : `CPF ${customer?.cpf || '-'}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrdemPrintButton
            data={{
              displayNumber: order.display_number ?? order.id,
              status: order.status,
              title: order.title,
              createdAt: order.created_at,
              updatedAt: order.updated_at,
              customer: {
                fullName: customer?.full_name ?? '',
                companyName: customer?.company_name ?? null,
                isCompany: Boolean(customer?.is_company),
                cpf: customer?.cpf ?? null,
                cnpj: customer?.cnpj ?? null,
                email: customer?.email ?? null,
                mobilePhone: customer?.mobile_phone ?? null,
                contactPhone: customer?.contact_phone ?? null,
                contactNotes: customer?.contact_notes ?? null,
                addressFull: customer?.address_full ?? null,
              },
              device: deviceModel ? `${deviceModel.brand} • ${deviceModel.device_type} • ${deviceModel.model}` : (order.brand || order.model ? `${order.brand || ''} ${order.model || ''}`.trim() : '-'),
              imei: order.imei ?? null,
              isWarranty: Boolean(order.is_warranty),
              estimatedReadyAt: order.estimated_ready_at,
              customerDescription: order.customer_description ?? null,
              internalDescription: order.internal_description ?? null,
              receivingNotes: order.receiving_notes ?? null,
              assistanceInfo: order.assistance_info ?? null,
            }}
            company={companySettings ? {
              name: companySettings.name ?? null,
              cnpj: companySettings.cnpj ?? null,
              address: companySettings.address ?? null,
              complement: companySettings.complement ?? null,
              zipCode: companySettings.zip_code ?? null,
              city: companySettings.city ?? null,
              state: companySettings.state ?? null,
              phone: companySettings.phone ?? null,
              email: companySettings.email ?? null,
              logoUrl: companySettings.logo_url ?? null,
            } : null}
          />
          <OrdemShareButtons
            orderId={order.id}
            publicOrderPath={order.share_token ? `/os/${order.share_token}` : null}
            displayNumber={order.display_number ?? order.id}
            title={order.title}
            customerName={customer?.is_company ? (customer?.company_name ?? '') : (customer?.full_name ?? '')}
            device={deviceModel ? `${deviceModel.brand} • ${deviceModel.device_type} • ${deviceModel.model}` : (order.brand || order.model ? `${order.brand || ''} ${order.model || ''}`.trim() : '-')}
            status={formatStatus(order.status)}
            estimatedReadyAt={order.estimated_ready_at}
            mobilePhone={customer?.mobile_phone}
            email={customer?.email}
          />
        </div>
      </div>

      <OrderCustomerCard customer={customer} />

      {error ? (
        <p className="text-sm text-destructive">
          {error === 'titulo_obrigatorio' ? 'Título é obrigatório.' : null}
          {error === 'status_invalido' ? 'Status inválido.' : null}
          {error === 'nao_foi_possivel_salvar' ? 'Não foi possível salvar agora.' : null}
          {error === 'nao_foi_possivel_excluir' ? 'Não foi possível excluir agora.' : null}
          {error === 'dados_invalidos' ? 'Dados inválidos.' : null}
          {error && !['titulo_obrigatorio', 'status_invalido', 'nao_foi_possivel_salvar', 'nao_foi_possivel_excluir', 'dados_invalidos'].includes(error)
            ? 'Não foi possível concluir agora.'
            : null}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Editar</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">#{order.display_number ?? order.id}</Badge>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          <CardDescription>
            Criada em {formatDateTimeBr(order.created_at)} • Atualizada em {formatDateTimeBr(order.updated_at)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateOrderAction} className="space-y-6">
            <input type="hidden" name="orderId" value={order.id} />

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={order.status}
                >
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

              <div className="space-y-2">
                <Label htmlFor="imei">Número de série / IMEI</Label>
                <Input id="imei" name="imei" defaultValue={order.imei || ''} placeholder="Digite o número" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 rounded-md border p-3">
                <input
                  id="isWarranty"
                  name="isWarranty"
                  type="checkbox"
                  defaultChecked={Boolean(order.is_warranty)}
                />
                <Label htmlFor="isWarranty" className="cursor-pointer">Serviço em garantia</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
                <Input
                  id="estimatedReadyAt"
                  name="estimatedReadyAt"
                  type="datetime-local"
                  defaultValue={formatDateTimeLocal(order.estimated_ready_at)}
                />
              </div>
            </div>

            <OrderPasscodeFields
              defaultPasscodeType={order.passcode_type === 'text' || order.passcode_type === 'pattern' ? order.passcode_type : 'none'}
              defaultPasscodeText={order.passcode_text || ''}
              defaultPasscodePattern={order.passcode_pattern || ''}
            />

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" defaultValue={order.title} placeholder="Título" />
            </div>

            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Input
                value={deviceModel ? `${deviceModel.brand} • ${deviceModel.device_type} • ${deviceModel.model}` : (order.brand || order.model ? `${order.brand || ''} ${order.model || ''}`.trim() : '-')}
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerDescription">Descrição para o cliente</Label>
              <Textarea id="customerDescription" name="customerDescription" defaultValue={order.customer_description || ''} placeholder="Texto que o cliente vê" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalDescription">Descrição interna</Label>
              <Textarea id="internalDescription" name="internalDescription" defaultValue={order.internal_description || ''} placeholder="Anotações internas" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receivingNotes">Observações do recebimento</Label>
              <Textarea id="receivingNotes" name="receivingNotes" defaultValue={order.receiving_notes || ''} placeholder="Checklist, avarias, acessórios, etc." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistanceInfo">Informações sobre a assistência</Label>
              <Textarea id="assistanceInfo" name="assistanceInfo" defaultValue={order.assistance_info || ''} placeholder="Informações técnicas, serviços realizados, peças trocadas, etc." />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <UpdateOrderSubmitButton />
              <Button variant="outline" asChild>
                <Link href="/portal/ordens">Voltar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Excluir</CardTitle>
          <CardDescription>Essa ação não pode ser desfeita.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteOrderAction} className="flex items-center justify-between gap-3 flex-wrap">
            <input type="hidden" name="orderId" value={order.id} />
            <p className="text-sm text-muted-foreground">
              Excluir ordem <b>#{order.display_number ?? order.id}</b> — {order.title}
            </p>
            <Button type="submit" variant="destructive">Excluir</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

