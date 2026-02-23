import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'
import { previsaoToISO } from '@/lib/utils/previsao-ordem'
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

async function createOrderAction(formData: FormData) {
  'use server'

  const document = normalizeDocument(String(formData.get('document') || formData.get('cpf') || ''))
  const customerId = String(formData.get('customerId') || '').trim()

  const title = String(formData.get('title') || '').trim()
  const status = String(formData.get('status') || 'orcamento').trim()
  const deviceModelId = String(formData.get('deviceModelId') || '').trim()
  const imei = String(formData.get('imei') || '').trim()
  const color = String(formData.get('color') || '').trim()
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

  const estimatedReadyAt = previsaoToISO(estimatedReadyAtRaw)

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
  if (estimatedReadyAt && new Date(estimatedReadyAt).getTime() < Date.now() - 60_000) {
    redirect('/portal/ordens/nova?error=previsao_invalida')
  }

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  let sellerUserId = user.id
  const formSellerId = String(formData.get('seller_user_id') || '').trim()
  if (formSellerId && role === 'admin') {
    const { data: sellerUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', formSellerId)
      .in('role', ['admin', 'staff'])
      .maybeSingle()
    if (sellerUser?.id) sellerUserId = sellerUser.id
  }

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
      seller_user_id: sellerUserId,
      device_model_id: deviceModelId || null,
      imei: imei || null,
      color: color || null,
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

  if (error) redirect('/portal/ordens?toast=order_error&error=nao_foi_possivel_criar_os')

  const hasDeviceInfo = deviceModelId || brand || model || deviceType
  if (hasDeviceInfo) {
    try {
      let existingDevice: { id: string } | null = null
      if (deviceModelId) {
        const { data: found } = await supabase
          .from('customer_devices')
          .select('id')
          .eq('customer_id', customerId)
          .eq('device_model_id', deviceModelId)
          .maybeSingle()
        existingDevice = found
      } else if (brand || model) {
        const { data: found } = await supabase
          .from('customer_devices')
          .select('id')
          .eq('customer_id', customerId)
          .is('device_model_id', null)
          .eq('brand', brand || '')
          .eq('model', model || '')
          .eq('device_type', deviceType || '')
          .maybeSingle()
        existingDevice = found
      }
      if (existingDevice) {
        await supabase
          .from('customer_devices')
          .update({ imei: imei || null, color: color || null })
          .eq('id', existingDevice.id)
      } else {
        await supabase.from('customer_devices').insert({
          customer_id: customerId,
          device_model_id: deviceModelId || null,
          brand: brand || null,
          model: model || null,
          device_type: deviceType || null,
          imei: imei || null,
          color: color || null,
        })
      }
    } catch (_) {
      // Tabela customer_devices pode não existir ainda (migration não aplicada); ordem já foi criada
    }
  }

  return { redirectTo: `/portal/ordens/${insertedOrder.id}?toast=order_created` }
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
  const isAdmin = role === 'admin'
  let sellerOptions: Array<{ id: string; full_name: string | null; email: string | null }> = []
  if (isAdmin) {
    const supabase = await createSupabaseServerClient()
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('role', ['admin', 'staff'])
      .order('email')
    sellerOptions = (users ?? []).map((u) => ({
      id: u.id,
      full_name: u.full_name ?? null,
      email: u.email ?? null,
    }))
  }

  return (
    <NovaOrdemClient
      action={createOrderAction}
      sellerName={sellerName}
      isAdmin={isAdmin}
      sellerOptions={sellerOptions}
      currentUserId={user.id}
      initialError={error ? getOrdemErrorMessage(error) : undefined}
      duplicateOrderId={duplicate || undefined}
    />
  )
}

