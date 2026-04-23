'use server'

import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'
import { getOrdemPortalPath, getOrdemPortalPathSegment } from '@/lib/orders/ordem-portal-path'
import { parsePaymentMethodsJson, parseServicesJson } from '@/lib/orders/order-form-parsers'

function onlyDigits (s: string): string {
  return s.replace(/\D/g, '')
}

function waToMobileNational (waFrom: string): string {
  const d = onlyDigits(waFrom)
  if (d.length >= 10) return d.slice(-11)
  return d
}

export type CreateOrderFromWhatsappResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }

/**
 * Cria uma OS em orçamento usando `draft_os` da conversa WhatsApp (portal staff).
 */
export async function createOrderFromWhatsappConversationAction (
  conversationId: string,
): Promise<CreateOrderFromWhatsappResult> {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  const normalizedRole = role === 'customer' ? 'user' : role
  if (
    normalizedRole !== 'staff' &&
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) {
    return { ok: false, error: 'forbidden' }
  }

  const supabase = await createSupabaseServerClient()

  const { data: conv, error: cErr } = await supabase
    .from('whatsapp_conversations')
    .select('id, wa_from, draft_os')
    .eq('id', conversationId)
    .maybeSingle()

  if (cErr || !conv) {
    return { ok: false, error: 'conversation_not_found' }
  }

  const draft = (conv.draft_os as Record<string, string> | null) || {}
  const fullName = String(draft.full_name || '').trim()
  const cpfRaw = onlyDigits(String(draft.cpf || ''))
  const deviceDescription = String(draft.device_description || '').trim()
  const issueDescription = String(draft.issue_description || '').trim()

  if (!fullName || cpfRaw.length !== 11 || !issueDescription) {
    return { ok: false, error: 'draft_incomplete' }
  }

  const titleBase = issueDescription.slice(0, 120)
  const title = titleBase || 'Orçamento WhatsApp'
  const customerDescription = [deviceDescription && `Aparelho: ${deviceDescription}`, issueDescription]
    .filter(Boolean)
    .join('\n\n')

  const mobileNational = waToMobileNational(String(conv.wa_from))

  let customerId: string | null = null
  const { data: byCpf } = await supabase.from('customers').select('id').eq('cpf', cpfRaw).maybeSingle()

  if (byCpf?.id) {
    customerId = byCpf.id as string
  } else {
    const { data: phoneRows } = await supabase.from('customers').select('id, mobile_phone')
    const match = (phoneRows || []).find((r) => {
      const m = onlyDigits(String((r as { mobile_phone?: string }).mobile_phone || ''))
      return m.length >= 8 && (m.endsWith(mobileNational) || mobileNational.endsWith(m))
    })
    if (match && 'id' in match) {
      customerId = (match as { id: string }).id
    }
  }

  if (!customerId) {
    const { data: created, error: insErr } = await supabase
      .from('customers')
      .insert({
        full_name: fullName,
        cpf: cpfRaw,
        mobile_phone: mobileNational.length >= 10 ? mobileNational : null,
      })
      .select('id')
      .single()

    if (insErr || !created?.id) {
      console.error('[whatsapp-create-order] customer insert', insErr)
      return { ok: false, error: 'customer_create_failed' }
    }
    customerId = created.id as string
  }

  const services = parseServicesJson(null)
  const { data: insertedOrder, error: oErr } = await supabase
    .from('service_orders')
    .insert({
      customer_id: customerId,
      title,
      status: 'orcamento',
      brand: null,
      model: null,
      service: null,
      created_by: user.id,
      seller_user_id: user.id,
      device_model_id: null,
      imei: null,
      color: null,
      device_location: null,
      is_warranty: false,
      estimated_ready_at: null,
      passcode_type: null,
      passcode_text: null,
      passcode_pattern: null,
      payment_methods: parsePaymentMethodsJson(null),
      customer_description: customerDescription || null,
      receiving_notes: null,
      device_entry_checks: null,
      services: services.items,
      services_total_cents: services.totalValueCents,
      services_cost_total_cents: services.totalCostCents,
    })
    .select('id, display_number')
    .single()

  if (oErr || !insertedOrder) {
    console.error('[whatsapp-create-order] order insert', oErr)
    return { ok: false, error: 'order_create_failed' }
  }

  try {
    await applyOrderStatusStockTransition({
      supabase,
      orderId: insertedOrder.id,
      previousStatus: 'orcamento',
      nextStatus: 'orcamento',
      services: services.items,
      actorUserId: user.id,
    })
  } catch (e) {
    console.error('[whatsapp-create-order][stock]', e)
  }

  await supabase
    .from('whatsapp_conversations')
    .update({ service_order_id: insertedOrder.id as string })
    .eq('id', conversationId)

  const inserted = insertedOrder as { id: string; display_number: number | null }
  const path = getOrdemPortalPath(inserted)
  const seg = getOrdemPortalPathSegment(inserted)
  return {
    ok: true,
    redirectTo: `${path}?toast=order_created&os=${encodeURIComponent(seg)}`,
  }
}
