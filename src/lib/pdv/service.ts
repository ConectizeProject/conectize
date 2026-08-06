import type { SupabaseClient } from '@supabase/supabase-js'

type AuthCtx = {
  organizationId: string
  userId: string
  supabase: SupabaseClient
}

/** Sessão de caixa aberta da organização ativa (compartilhada pelo PDV atual). */
export async function getOpenCashSession (auth: AuthCtx) {
  const { data, error } = await auth.supabase
    .from('pos_cash_sessions')
    .select('id, opened_by, opening_amount_cents, created_at')
    .eq('organization_id', auth.organizationId)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false as const, error: 'db_error' as const }
  if (!data) return { ok: false as const, error: 'cash_not_open' as const }
  return { ok: true as const, session: data }
}
