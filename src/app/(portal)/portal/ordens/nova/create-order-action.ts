'use server'

import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import {
  parseOrderDiscountCommissionFromFormData,
  toOrderDiscountCommissionDbPayload,
} from '@/lib/orders/order-discount-commission'
import {
  parsePaymentMethodsJson,
  parseServicesJson,
} from '@/lib/orders/order-form-parsers'
import { syncServiceOrderFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'
import { getOrdemPortalPath, getOrdemPortalPathSegment } from '@/lib/orders/ordem-portal-path'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { previsaoToISO } from '@/lib/utils/previsao-ordem'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '').trim()
}

export async function createOrderAction(formData: FormData) {
  const document = normalizeDocument(String(formData.get('document') || formData.get('cpf') || ''))
  const customerId = String(formData.get('customerId') || '').trim()

  const title = String(formData.get('title') || '').trim()
  const status = String(formData.get('status') || 'orcamento').trim()
  const deviceModelId = parseOptionalUuid(formData.get('deviceModelId'))
  const imei = String(formData.get('imei') || '').trim()
  const color = String(formData.get('color') || '').trim()
  const deviceLocation = String(formData.get('deviceLocation') || '').trim()
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
  const paymentMethods = parsePaymentMethodsJson(paymentMethodsJson)
  let discountCommission = toOrderDiscountCommissionDbPayload(
    parseOrderDiscountCommissionFromFormData(formData),
    services.totalValueCents,
  )

  const estimatedReadyAt = previsaoToISO(estimatedReadyAtRaw)

  const brand = String(formData.get('brand') || '').trim()
  const model = String(formData.get('model') || '').trim()
  const deviceType = String(formData.get('deviceType') || '').trim()

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
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/ordens/nova?error=sem_organizacao')

  const { data: customerRow } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!customerRow?.id) redirect('/portal/ordens/nova?error=cliente_invalido')

  let sellerUserId = user.id
  const formSellerId = String(formData.get('seller_user_id') || '').trim()
  const canPickSeller =
    role === 'admin' || role === 'platform_admin'
  if (formSellerId && canPickSeller) {
    const { data: sellerMember } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('user_id', formSellerId)
      .in('role_in_org', ['admin', 'staff'])
      .maybeSingle()
    if (sellerMember?.user_id) sellerUserId = sellerMember.user_id
  }

  if (discountCommission.commission_user_id) {
    const { data: commissionUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', discountCommission.commission_user_id)
      .in('role', ['admin', 'staff'])
      .maybeSingle()
    if (!commissionUser?.id) {
      discountCommission = {
        ...discountCommission,
        commission_user_id: null,
        commission_kind: null,
        commission_fixed_cents: null,
        commission_percent: null,
      }
    }
  }

  let deviceEntryChecks: unknown = null
  if (deviceEntryChecksJson && typeof deviceEntryChecksJson === 'string') {
    try {
      deviceEntryChecks = JSON.parse(deviceEntryChecksJson) as unknown
    } catch {
      deviceEntryChecks = null
    }
  }

  const { data: insertedOrder, error } = await supabase
    .from('service_orders')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      title,
      status,
      created_by: user.id,
      seller_user_id: sellerUserId,
      device_model_id: deviceModelId,
      imei: imei || null,
      color: color || null,
      device_location: deviceLocation || null,
      is_warranty: isWarranty,
      estimated_ready_at: estimatedReadyAt,
      passcode_type: (passcodeType === 'text' || passcodeType === 'pattern') ? passcodeType : null,
      passcode_text: passcodeType === 'text' ? (passcodeText || null) : null,
      passcode_pattern: passcodeType === 'pattern' ? (passcodePattern || null) : null,
      payment_methods: paymentMethods,
      customer_description: customerDescription || null,
      receiving_notes: receivingNotes || null,
      device_entry_checks: deviceEntryChecks,
      services: services.items,
      services_total_cents: services.totalValueCents,
      services_cost_total_cents: services.totalCostCents,
      ...discountCommission,
    })
    .select('id, display_number')
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
  } catch (err) {
    console.error('[order-create][stock-transition]', { orderId: insertedOrder.id, err })
  }

  try {
    await syncServiceOrderFinancialTransactions({
      supabase,
      orderId: insertedOrder.id,
      organizationId,
      orderRow: {
        id: insertedOrder.id,
        organization_id: organizationId,
        display_number: insertedOrder.display_number ?? null,
        payment_methods: paymentMethods,
        closed_at: null,
        updated_at: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[order-create][finance-sync]', { orderId: insertedOrder.id, err })
  }

  if (internalInitialComment) {
    const { data: me } = await supabase.from('users').select('full_name, email').eq('id', user.id).maybeSingle()
    const authorDisplayName = String(me?.full_name || me?.email || '').trim() || '(Sem nome)'
    const content = internalInitialComment.slice(0, 6000)
    await supabase.from('service_order_internal_comments').insert({
      service_order_id: insertedOrder.id,
      organization_id: organizationId,
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
          organization_id: organizationId,
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

  const inserted = insertedOrder as { id: string; display_number: number | null }
  const path = getOrdemPortalPath(inserted)
  const seg = getOrdemPortalPathSegment(inserted)
  return {
    redirectTo: `${path}?toast=order_created&os=${encodeURIComponent(seg)}`,
  }
}
