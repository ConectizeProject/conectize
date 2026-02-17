import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { NovaOrdemClient } from './NovaOrdemClient'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '').trim()
}

function parseServicesJson(raw: unknown) {
  if (!raw) return { items: [], totalValueCents: 0, totalCostCents: 0 }

  const parsed = JSON.parse(String(raw))
  const items = Array.isArray(parsed?.items) ? parsed.items : []

  const normalized = items
    .slice(0, 100)
    .map((item: any) => {
      return {
        description: String(item?.description || '').trim().slice(0, 240),
        valueCents: Math.max(0, Number.parseInt(String(item?.valueCents || '0'), 10) || 0),
        costCents: Math.max(0, Number.parseInt(String(item?.costCents || '0'), 10) || 0),
      }
    })
    .filter((s: any) => s.description || s.valueCents > 0 || s.costCents > 0)

  const totalValueCents = normalized.reduce((acc: number, s: any) => acc + s.valueCents, 0)
  const totalCostCents = normalized.reduce((acc: number, s: any) => acc + s.costCents, 0)

  return { items: normalized, totalValueCents, totalCostCents }
}

function getStatusLabel(status: string) {
  if (status === 'cpf_invalido') return 'CPF inválido.'
  if (status === 'cnpj_invalido') return 'CNPJ inválido.'
  if (status === 'title_obrigatorio') return 'Título é obrigatório.'
  if (status === 'customer_obrigatorio') return 'Selecione um cliente (CPF/CNPJ).'
  if (status === 'status_invalido') return 'Status inválido.'
  if (status === 'nao_foi_possivel_criar_cliente') return 'Não foi possível criar o cliente.'
  if (status === 'nao_foi_possivel_criar_os') return 'Não foi possível criar a ordem de serviço.'
  return 'Não foi possível salvar. Tente novamente.'
}

async function createOrderAction(formData: FormData) {
  'use server'

  const document = normalizeDocument(String(formData.get('document') || formData.get('cpf') || ''))
  const customerId = String(formData.get('customerId') || '').trim()

  const title = String(formData.get('title') || '').trim()
  const status = String(formData.get('status') || 'orcamento').trim()
  const deviceModelId = String(formData.get('deviceModelId') || '').trim()
  const imei = String(formData.get('imei') || '').trim()
  const customerDescription = String(formData.get('customerDescription') || '').trim()
  const internalDescription = String(formData.get('internalDescription') || '').trim()
  const receivingNotes = String(formData.get('receivingNotes') || '').trim()
  const isWarranty = String(formData.get('isWarranty') || '').trim() === '1'
  const estimatedReadyAtRaw = String(formData.get('estimatedReadyAt') || '').trim()
  const passcodeType = String(formData.get('passcodeType') || '').trim()
  const passcodeText = String(formData.get('passcodeText') || '').trim()
  const passcodePattern = String(formData.get('passcodePattern') || '').trim()
  const servicesJson = formData.get('servicesJson')
  const services = parseServicesJson(servicesJson)

  const estimatedReadyAt = (() => {
    if (!estimatedReadyAtRaw) return null
    const dt = new Date(estimatedReadyAtRaw)
    if (Number.isNaN(dt.getTime())) return null
    return dt.toISOString()
  })()

  const brand = String(formData.get('brand') || '').trim()
  const model = String(formData.get('model') || '').trim()
  const deviceType = String(formData.get('deviceType') || '').trim()
  const service = ''

  if (!document || (document.length !== 11 && document.length !== 14)) {
    redirect(`/portal/ordens/nova?error=${document && document.length > 11 ? 'cnpj_invalido' : 'cpf_invalido'}`)
  }
  if (!customerId) redirect('/portal/ordens/nova?error=customer_obrigatorio')
  if (!title) redirect('/portal/ordens/nova?error=title_obrigatorio')
  if (status !== 'orcamento' && status !== 'aprovado') redirect('/portal/ordens/nova?error=status_invalido')

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  const { data: insertedOrder, error } = await supabase
    .from('service_orders')
    .insert({
      customer_id: customerId,
      title,
      status,
      brand: brand || null,
      model: model || null,
      service: service || null,
      created_by: user.id,
      seller_user_id: user.id,
      device_model_id: deviceModelId || null,
      imei: imei || null,
      is_warranty: isWarranty,
      estimated_ready_at: estimatedReadyAt,
      passcode_type: (passcodeType === 'text' || passcodeType === 'pattern') ? passcodeType : null,
      passcode_text: passcodeType === 'text' ? (passcodeText || null) : null,
      passcode_pattern: passcodeType === 'pattern' ? (passcodePattern || null) : null,
      customer_description: customerDescription || null,
      internal_description: internalDescription || null,
      receiving_notes: receivingNotes || null,
      services: services.items,
      services_total_cents: services.totalValueCents,
      services_cost_total_cents: services.totalCostCents,
    })
    .select('id')
    .single()

  if (error) redirect('/portal/ordens?toast=order_error&error=Não%20foi%20poss%C3%ADvel%20criar%20a%20ordem%20de%20servi%C3%A7o.')

  redirect(`/portal/ordens/${insertedOrder.id}?toast=order_created`)
}

export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; duplicate?: string }>
}) {
  const { error, duplicate } = await searchParams

  const { user, role, fullName } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const sellerName = fullName || user.email || ''

  return (
    <NovaOrdemClient
      action={createOrderAction}
      sellerName={sellerName}
      initialError={error ? getStatusLabel(error) : undefined}
      duplicateOrderId={duplicate || undefined}
    />
  )
}

