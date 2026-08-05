import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  performBlingTokenRefresh,
  shouldRefreshBlingAccessToken,
  type HubConnection,
} from '@/lib/integrations/bling/api'
import {
  blingRefreshTokenErrorCode,
  blingRefreshTokenErrorToMessage,
} from '@/lib/integrations/bling/refresh-token-errors'

export type BlingScheduledRefreshSummary = {
  checked: number
  refreshed: number
  skipped: number
  failed: Array<{ id: string, error: string, code: string, message: string }>
}

/**
 * Percorre todas as conexões Bling com refresh_token e renova as que estão
 * expiradas ou próximas de expirar (mesma regra que `refreshBlingTokenIfNeeded`).
 * Usa service role (adequado para cron sem sessão de usuário).
 */
export async function runBlingTokenRefreshForAllConnections (): Promise<BlingScheduledRefreshSummary> {
  const supabase = createSupabaseServiceClient()

  const { data: rows, error } = await supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('platform_id', 'bling')
    .not('refresh_token', 'is', null)

  if (error) {
    throw new Error(error.message || 'hub_connections_query_failed')
  }

  const list = (rows || []) as HubConnection[]
  const failed: BlingScheduledRefreshSummary['failed'] = []
  let refreshed = 0
  let skipped = 0

  function pushFailure (id: string, rawError: string) {
    failed.push({
      id,
      error: rawError,
      code: blingRefreshTokenErrorCode(rawError),
      message: blingRefreshTokenErrorToMessage(rawError),
    })
  }

  for (const conn of list) {
    if (!shouldRefreshBlingAccessToken(conn.token_expires_at)) {
      skipped++
      continue
    }

    try {
      const result = await performBlingTokenRefresh(conn, { supabase })
      if (result.ok === true) {
        refreshed++
      } else {
        pushFailure(conn.id, result.error)
      }
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'unexpected_refresh_exception'
      pushFailure(conn.id, message)
    }
  }

  return {
    checked: list.length,
    refreshed,
    skipped,
    failed,
  }
}
