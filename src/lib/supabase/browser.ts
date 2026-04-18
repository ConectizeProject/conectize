import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

/**
 * Cliente singleton (createBrowserClient usa cache interno no browser).
 * Usado para parar o auto-refresh quando a rede/DNS falha e evitar loop de
 * tentativas ao host do projeto (logs em cascata no console).
 */
const clientHolder: { current: SupabaseClient | null } = { current: null }

let consecutiveNetworkFailures = 0
const FAILURES_BEFORE_STOP_AUTO_REFRESH = 2

let onlineListenerAttached = false

function attachOnlineListenerOnce () {
  if (typeof window === 'undefined' || onlineListenerAttached) return
  onlineListenerAttached = true
  window.addEventListener('online', () => {
    consecutiveNetworkFailures = 0
    void clientHolder.current?.auth.startAutoRefresh()
  })
}

function buildFetchForSupabase (): typeof fetch {
  return async (input, init) => {
    try {
      const res = await fetch(input, init)
      consecutiveNetworkFailures = 0
      return res
    } catch (err) {
      consecutiveNetworkFailures++
      if (
        consecutiveNetworkFailures >= FAILURES_BEFORE_STOP_AUTO_REFRESH &&
        clientHolder.current
      ) {
        void clientHolder.current.auth.stopAutoRefresh()
      }
      throw err
    }
  }
}

export function createSupabaseBrowserClient () {
  const { url, anonKey } = getSupabaseEnv()
  attachOnlineListenerOnce()

  const client = createBrowserClient(url, anonKey, {
    global: {
      fetch: buildFetchForSupabase(),
    },
  })
  clientHolder.current = client
  return client
}
