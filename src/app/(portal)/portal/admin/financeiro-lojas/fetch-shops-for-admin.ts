import type { SupabaseClient } from '@supabase/supabase-js'

export type ShopOption = {
  id: string
  label: string
}

/**
 * Lojas B2B: cliente empresa ou com membro portal.
 */
export async function fetchShopCustomersForAdmin (
  supabase: SupabaseClient,
): Promise<ShopOption[]> {
  const [{ data: members }, { data: customers }] = await Promise.all([
    supabase.from('customer_portal_members').select('customer_id'),
    supabase
      .from('customers')
      .select('id, company_name, trade_name, full_name, is_company')
      .order('trade_name', { ascending: true }),
  ])

  const memberIds = new Set(
    (members ?? []).map((m: { customer_id: string }) => m.customer_id),
  )

  const list = (customers ?? []).filter(
    (c: { id: string; is_company: boolean | null }) =>
      Boolean(c.is_company) || memberIds.has(c.id),
  )

  return list.map((c: {
    id: string
    company_name: string | null
    trade_name: string | null
    full_name: string | null
  }) => ({
    id: c.id,
    label:
      String(c.trade_name || c.company_name || c.full_name || c.id).trim() || c.id,
  }))
}
