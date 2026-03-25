import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalPaymentMethodCatalogItem = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: { installments: number; fee_percent: number }[]
  sort_order: number
}

/**
 * Catálogo de formas de pagamento (Server Components / waterfall).
 * Mesma query que GET /api/portal/payment-methods.
 */
export async function fetchPaymentMethodsCatalogForPortal(
  supabase: SupabaseClient
): Promise<PortalPaymentMethodCatalogItem[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, description, type, fee_percent, credit_installment_fees, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[fetchPaymentMethodsCatalogForPortal]', error)
    return []
  }

  return (data ?? []) as PortalPaymentMethodCatalogItem[]
}
