import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'

/**
 * `handle_new_user` (trigger em auth.users) sempre insere membership na org host.
 * Fluxos que criam o usuário via service role e depois vinculam outra org devem
 * remover essa linha para não dar acesso cruzado à Conectize.
 */
export async function stripAutoHostOrganizationMembership (
  supabase: SupabaseClient,
  userId: string,
): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('user_id', userId)
    .eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
  return error
}
