'use server'

import { requireAdmin } from '@/lib/auth/portal-api'
import { syncServiceOrderFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export type ApplyBulkPaymentResult =
  | { ok: true; updated: number }
  | { ok: false; message: string }

export async function applyBulkPaymentMethodsAction (
  _prev: ApplyBulkPaymentResult | null,
  formData: FormData,
): Promise<ApplyBulkPaymentResult> {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return { ok: false, message: 'Sem permissão.' }
  }

  const supabase = auth.supabase
  const customerId = String(formData.get('customerId') || '').trim()
  const orderIdsRaw = String(formData.get('orderIds') || '').trim()
  const paymentMethodId = parseOptionalUuid(formData.get('paymentMethodId'))
  const installments = Math.max(1, Math.min(24, Number(formData.get('installments')) || 1))

  if (!customerId || !paymentMethodId) {
    return { ok: false, message: 'Loja e forma de pagamento são obrigatórios.' }
  }

  const { data: paymentMethod, error: paymentMethodErr } = await supabase
    .from('payment_methods')
    .select('id, conta_id')
    .eq('organization_id', auth.organizationId)
    .eq('id', paymentMethodId)
    .maybeSingle()

  if (paymentMethodErr || !paymentMethod?.id) {
    return { ok: false, message: 'Forma de pagamento inválida para a organização atual.' }
  }
  if (!paymentMethod.conta_id) {
    return {
      ok: false,
      message: 'A forma de pagamento selecionada não está vinculada a uma conta financeira.',
    }
  }

  const orderIds = orderIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (orderIds.length === 0) {
    return { ok: false, message: 'Selecione ao menos uma OS.' }
  }

  const { data: orders, error: fetchErr } = await supabase
    .from('service_orders')
    .select('id, customer_id, organization_id, services_total_cents, display_number, closed_at, updated_at')
    .in('id', orderIds)

  if (fetchErr || !orders?.length) {
    return { ok: false, message: 'Não foi possível carregar as ordens.' }
  }

  for (const o of orders) {
    if (o.customer_id !== customerId) {
      return { ok: false, message: 'Uma ou mais OS não pertencem à loja selecionada.' }
    }
  }

  let updated = 0
  for (const o of orders) {
    const total = Math.max(0, Number(o.services_total_cents) || 0)
    const payment_methods = [
      {
        payment_method_id: paymentMethodId,
        installments,
        value_cents: total,
      },
    ]
    const { error: upErr } = await supabase
      .from('service_orders')
      .update({
        payment_methods,
        updated_at: new Date().toISOString(),
      })
      .eq('id', o.id)

    if (upErr) {
      return { ok: false, message: upErr.message || 'Erro ao atualizar OS.' }
    }

    try {
      await syncServiceOrderFinancialTransactions({
        supabase,
        orderId: o.id,
        organizationId: auth.organizationId,
        orderRow: {
          id: o.id,
          organization_id: o.organization_id,
          display_number: o.display_number,
          payment_methods,
          closed_at: o.closed_at,
          updated_at: new Date().toISOString(),
        },
      })
    } catch (err) {
      console.error('[bulk-payment][finance-sync]', { orderId: o.id, err })
      return { ok: false, message: 'Pagamentos salvos, mas houve erro ao registrar no financeiro.' }
    }

    updated += 1
  }

  return { ok: true, updated }
}
