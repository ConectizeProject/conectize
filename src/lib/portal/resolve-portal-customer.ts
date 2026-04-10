import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalCustomerRow = {
  id: string
  cpf: string | null
  cnpj: string | null
  full_name: string | null
  company_name: string | null
  trade_name: string | null
  is_company: boolean | null
}

/**
 * Cliente do portal: claim por auth_user_id ou membro B2B (customer_portal_members).
 */
export async function resolvePortalCustomer (
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  customer: PortalCustomerRow | null
  effectiveTaxId: string | null
  source: 'auth_user' | 'portal_member' | 'none'
}> {
  const { data: byAuth } = await supabase
    .from('customers')
    .select('id, cpf, cnpj, full_name, company_name, trade_name, is_company')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (byAuth) {
    const row = byAuth as PortalCustomerRow
    const effectiveTaxId = row.is_company
      ? (row.cnpj || null)
      : (row.cpf || null)
    return { customer: row, effectiveTaxId, source: 'auth_user' }
  }

  const { data: member } = await supabase
    .from('customer_portal_members')
    .select('customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!member?.customer_id) {
    return { customer: null, effectiveTaxId: null, source: 'none' }
  }

  const { data: byMember } = await supabase
    .from('customers')
    .select('id, cpf, cnpj, full_name, company_name, trade_name, is_company')
    .eq('id', member.customer_id)
    .maybeSingle()

  if (!byMember) {
    return { customer: null, effectiveTaxId: null, source: 'none' }
  }

  const row = byMember as PortalCustomerRow
  const effectiveTaxId = row.is_company
    ? (row.cnpj || null)
    : (row.cpf || null)

  return { customer: row, effectiveTaxId, source: 'portal_member' }
}
