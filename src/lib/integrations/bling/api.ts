import { createSupabaseServerClient } from '@/lib/supabase/server'

const BLING_API_BASE_URL = 'https://www.bling.com.br/Api/v3'
const BLING_PLATFORM_ID = 'bling'

type HubConnection = {
  id: string
  platform_id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  metadata: Record<string, unknown> | null
  created_by: string | null
}

type BlingTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type BlingRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
}

type BlingClient = {
  request: <T = unknown>(options: BlingRequestOptions) => Promise<T>
}

function isTokenExpired (expiresAt: string | null): boolean {
  if (!expiresAt) return true
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return true
  // margem de segurança de 60s
  const nowWithMargin = Date.now() + 60_000
  return expiry <= nowWithMargin
}

export async function getBlingConnectionForCurrentUser () {
  const supabase = await createSupabaseServerClient()
  const { data: authClaims } = await supabase.auth.getUser()
  const userId = authClaims.user?.id
  if (!userId) {
    return { ok: false as const, error: 'not_authenticated' as const }
  }

  const { data, error } = await supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('platform_id', BLING_PLATFORM_ID)
    .eq('created_by', userId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'bling_not_connected' as const }
  }

  return { ok: true as const, connection: data as HubConnection }
}

export async function getBlingConnectionById (id: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('platform_id', BLING_PLATFORM_ID)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'bling_connection_not_found' as const }
  }

  return { ok: true as const, connection: data as HubConnection }
}

export async function refreshBlingTokenIfNeeded (connection: HubConnection) {
  if (!connection.refresh_token || !isTokenExpired(connection.token_expires_at)) {
    return connection
  }

  const clientId = process.env.BLING_CLIENT_ID
  const clientSecret = process.env.BLING_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return connection
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${BLING_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '1.0',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }),
  })

  const data = (await res.json().catch(() => null)) as BlingTokenResponse | null

  if (!res.ok || !data?.access_token) {
    return connection
  }

  const expiresIn = Number(data.expires_in) || 3600
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const supabase = await createSupabaseServerClient()
  const { data: updated } = await supabase
    .from('hub_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      token_expires_at: tokenExpiresAt,
      metadata: {
        ...(connection.metadata || {}),
        scope: data.scope || (connection.metadata as { scope?: string } | null)?.scope || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .maybeSingle()

  if (!updated) {
    return connection
  }

  return updated as HubConnection
}

export async function createBlingClientFromConnection (rawConnection: HubConnection): Promise<BlingClient> {
  const connection = await refreshBlingTokenIfNeeded(rawConnection)
  const token = connection.access_token
  if (!token) {
    throw new Error('bling_access_token_missing')
  }

  async function request<T> (options: BlingRequestOptions): Promise<T> {
    const method = options.method || 'GET'
    const url = new URL(`${BLING_API_BASE_URL}${options.path}`)

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: '1.0',
        Authorization: `Bearer ${token}`,
      },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(options.body ?? {}),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const message =
        (data && (data.error_description || data.error || data.message)) ||
        `bling_request_failed_${res.status}`
      throw new Error(String(message))
    }

    return data as T
  }

  return { request }
}

export async function getBlingClientForCurrentUser () {
  const result = await getBlingConnectionForCurrentUser()
  if (!result.ok) return result
  const client = await createBlingClientFromConnection(result.connection)
  return { ok: true as const, client, connection: result.connection }
}

export async function getBlingClientByConnectionId (connectionId: string) {
  const result = await getBlingConnectionById(connectionId)
  if (!result.ok) return result
  const client = await createBlingClientFromConnection(result.connection)
  return { ok: true as const, client, connection: result.connection }
}


