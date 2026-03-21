import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'
import { previsaoToISO } from '@/lib/utils/previsao-ordem'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'
import { NovaOrdemClient } from './NovaOrdemClient'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '').trim()
}

function parsePaymentMethodsJson(raw: unknown): Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(String(raw))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: unknown) => item && typeof item === 'object' && (item as any).payment_method_id)
      .map((item: any) => {
        const id = parseOptionalUuid(item.payment_method_id)
        if (!id) return null
        return {
          payment_method_id: id,
          installments: item.installments != null ? Math.max(1, Math.min(24, Number(item.installments) || 1)) : undefined,
          value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
        }
      })
      .filter(Boolean) as Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
  } catch {
    return []
  }
}

function parseServicesJson(raw: unknown) {
  if (!raw) return { items: [], totalValueCents: 0, totalCostCents: 0 }

  const parsed = JSON.parse(String(raw))
  const items = Array.isArray(parsed?.items) ? parsed.items : []

  const normalized = items
    .slice(0, 100)
    .map((item: any) => {
      const description = String(item?.description || '').trim().slice(0, 240)
      const kind = item?.kind === 'product' ? 'product' : 'service'
      const quantityRaw =
        kind === 'product'
          ? Number.parseInt(String(item?.quantity ?? '1'), 10)
          : 1
      const quantity =
        Number.isFinite(quantityRaw) && quantityRaw > 0
          ? Math.min(9999, Math.max(1, quantityRaw))
          : 1
      const unitValueCentsRaw = item?.unitValueCents ?? item?.valueCents ?? 0
      const unitCostCentsRaw = item?.unitCostCents ?? item?.costCents ?? 0
      const unitValueCents = Math.max(
        0,
        Number.parseInt(String(unitValueCentsRaw || '0'), 10) || 0,
      )
      const unitCostCents = Math.max(
        0,
        Number.parseInt(String(unitCostCentsRaw || '0'), 10) || 0,
      )
      const valueCents = unitValueCents * quantity
      const costCents = unitCostCents * quantity
      const sourceProductIdRaw = String(item?.sourceProductId || '').trim()
      return {
        kind,
        description,
        quantity,
        unitValueCents,
        unitCostCents,
        valueCents,
        costCents,
        sourceProductId: sourceProductIdRaw || null,
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
  const deviceModelId = parseOptionalUuid(formData.get('deviceModelId'))
  const imei = String(formData.get('imei') || '').trim()
  const color = String(formData.get('color') || '').trim()
  const customerDescription = String(formData.get('customerDescription') || '').trim()
  const internalInitialComment = String(formData.get('internalInitialComment') || '').trim()
  const receivingNotes = String(formData.get('receivingNotes') || '').trim()
  const deviceEntryChecksJson = String(formData.get('deviceEntryChecksJson') || '').trim()
  const isWarranty = String(formData.get('isWarranty') || '').trim() === '1'
  const estimatedReadyAtRaw = String(formData.get('estimatedReadyAt') || '').trim()
  const passcodeType = String(formData.get('passcodeType') || '').trim()
  const passcodeText = String(formData.get('passcodeText') || '').trim()
  const passcodePattern = String(formData.get('passcodePattern') || '').trim()
  const paymentMethodsJson = formData.get('paymentMethodsJson')
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
  const validStatuses = ['orcamento', 'aguardando_aprovacao', 'aprovado']
  if (!validStatuses.includes(status)) redirect('/portal/ordens/nova?error=status_invalido')
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

  let deviceEntryChecks: any = null
  if (deviceEntryChecksJson) {
    try {
      deviceEntryChecks = JSON.parse(deviceEntryChecksJson)
    } catch {
      deviceEntryChecks = null
    }
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
      device_model_id: deviceModelId,
      imei: imei || null,
      color: color || null,
      is_warranty: isWarranty,
      estimated_ready_at: estimatedReadyAt,
      passcode_type: (passcodeType === 'text' || passcodeType === 'pattern') ? passcodeType : null,
      passcode_text: passcodeType === 'text' ? (passcodeText || null) : null,
      passcode_pattern: passcodeType === 'pattern' ? (passcodePattern || null) : null,
      payment_methods: parsePaymentMethodsJson(paymentMethodsJson),
      customer_description: customerDescription || null,
      receiving_notes: receivingNotes || null,
      device_entry_checks: deviceEntryChecks,
      services: services.items,
      services_total_cents: services.totalValueCents,
      services_cost_total_cents: services.totalCostCents,
    })
    .select('id')
    .single()

  if (error) {
    const saveQs = new URLSearchParams()
    saveQs.set('toast', 'order_error')
    saveQs.set('error', 'nao_foi_possivel_criar_os')
    const ec = String(error.code || '').trim().slice(0, 48)
    const emRaw = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' — ')
    const em = String(emRaw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320)
    if (ec) saveQs.set('ec', ec)
    if (em) saveQs.set('em', em)
    console.error('[order-create]', { code: error.code, message: error.message, details: error.details, hint: error.hint })
    redirect(`/portal/ordens?${saveQs.toString()}`)
  }

  try {
    await applyOrderStatusStockTransition({
      supabase,
      orderId: insertedOrder.id,
      previousStatus: 'orcamento',
      nextStatus: status,
      services: services.items,
      actorUserId: user.id,
    })
  } catch (_) {}

  if (internalInitialComment) {
    const { data: me } = await supabase.from('users').select('full_name, email').eq('id', user.id).maybeSingle()
    const authorDisplayName = String(me?.full_name || me?.email || '').trim() || '(Sem nome)'
    const content = internalInitialComment.slice(0, 6000)
    await supabase.from('service_order_internal_comments').insert({
      service_order_id: insertedOrder.id,
      author_user_id: user.id,
      author_display_name: authorDisplayName,
      content,
    })
  }

  const hasDeviceInfo = deviceModelId || brand || model || deviceType
  if (hasDeviceInfo) {
    const hasPasscodeText = passcodeType === 'text' && !!passcodeText
    const hasPasscodePattern = passcodeType === 'pattern' && !!passcodePattern
    const deviceNotes = hasPasscodeText
      ? `Senha (texto): ${passcodeText}`
      : hasPasscodePattern
        ? `Senha (padrão): ${passcodePattern}`
        : null

    try {
      let existingDevice: { id: string; notes: string | null } | null = null
      if (deviceModelId) {
        const { data: found } = await supabase
          .from('customer_devices')
          .select('id, notes')
          .eq('customer_id', customerId)
          .eq('device_model_id', deviceModelId)
          .maybeSingle()
        existingDevice = found
      } else if (brand || model) {
        const { data: found } = await supabase
          .from('customer_devices')
          .select('id, notes')
          .eq('customer_id', customerId)
          .is('device_model_id', null)
          .eq('brand', brand || '')
          .eq('model', model || '')
          .eq('device_type', deviceType || '')
          .maybeSingle()
        existingDevice = found
      }
      if (existingDevice) {
        const updatePayload: Record<string, unknown> = {
          imei: imei || null,
          color: color || null,
        }
        if (deviceNotes) {
          updatePayload.notes = existingDevice.notes
            ? `${deviceNotes}\n${existingDevice.notes}`
            : deviceNotes
        }
        await supabase
          .from('customer_devices')
          .update(updatePayload)
          .eq('id', existingDevice.id)
      } else {
        await supabase.from('customer_devices').insert({
          customer_id: customerId,
          device_model_id: deviceModelId,
          brand: brand || null,
          model: model || null,
          device_type: deviceType || null,
          imei: imei || null,
          color: color || null,
          notes: deviceNotes || null,
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

  const supabase = await createSupabaseServerClient()
  const sellerName = fullName || user.email || ''
  const isAdmin = role === 'admin'

  const [sellerOptionsResult, deviceModels] = await Promise.all([
    isAdmin
      ? supabase.from('users').select('id, email, full_name').in('role', ['admin', 'staff']).order('email')
      : Promise.resolve({ data: [] }),
    fetchDeviceModelsForSelector(supabase),
  ])

  const sellerOptions: Array<{ id: string; full_name: string | null; email: string | null }> = isAdmin
    ? (sellerOptionsResult.data ?? []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name ?? null,
        email: u.email ?? null,
      }))
    : []

  return (
    <NovaOrdemClient
      action={createOrderAction}
      sellerName={sellerName}
      isAdmin={isAdmin}
      sellerOptions={sellerOptions}
      deviceModels={deviceModels}
      currentUserId={user.id}
      initialError={error ? getOrdemErrorMessage(error) : undefined}
      duplicateOrderId={duplicate || undefined}
    />
  )
}

