import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BLING_API_V3_BASE_URL } from '@/lib/integrations/bling/constants'

const BLING_API_BASE_URL = BLING_API_V3_BASE_URL
const BLING_PLATFORM_ID = 'bling'

export type HubConnection = {
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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
}

type BlingClient = {
  request: <T = unknown>(options: BlingRequestOptions) => Promise<T>
}

type BlingConnectionCurrentResult =
  | { ok: true, connection: HubConnection }
  | { ok: false, error: 'not_authenticated' | 'bling_not_connected' }

type BlingConnectionByIdResult =
  | { ok: true, connection: HubConnection }
  | { ok: false, error: 'bling_connection_not_found' }

type BlingClientCurrentResult =
  | { ok: true, client: BlingClient, connection: HubConnection }
  | { ok: false, error: 'not_authenticated' | 'bling_not_connected' }

type BlingClientByIdResult =
  | { ok: true, client: BlingClient, connection: HubConnection }
  | { ok: false, error: 'bling_connection_not_found' }

function stringifyBlingValidationFields (value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null

  const items = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return stringifyBlingErrorValue(item)
      }

      const field = item as Record<string, unknown>
      const fieldName = stringifyBlingErrorValue(field.field ?? field.name ?? field.campo)
      const fieldMessage = stringifyBlingErrorValue(field.message ?? field.mensagem ?? field.description ?? field.descricao)

      if (fieldName && fieldMessage) return `${fieldName}: ${fieldMessage}`
      return fieldMessage ?? fieldName
    })
    .filter((item): item is string => Boolean(item))

  return items.length > 0 ? items.join(', ') : null
}

function stringifyBlingErrorValue (value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim()
    return normalizedValue || null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => stringifyBlingErrorValue(item))
      .filter((item): item is string => Boolean(item))

    return items.length > 0 ? items.join(', ') : null
  }

  const objectValue = value as Record<string, unknown>
  const preferredKeys = [
    'message',
    'mensagem',
    'descricao',
    'detail',
    'error',
    'error_description',
  ]

  const preferredParts = preferredKeys
    .map((key) => stringifyBlingErrorValue(objectValue[key]))
    .filter((item): item is string => Boolean(item))

  const fieldsMessage = stringifyBlingValidationFields(objectValue.fields)

  if (preferredParts.length > 0 || fieldsMessage) {
    const message = preferredParts.join(' | ')
    if (message && fieldsMessage) return `${message} | Campos: ${fieldsMessage}`
    return message || fieldsMessage
  }

  const entries = Object.entries(objectValue)
    .map(([key, itemValue]) => {
      const parsedValue = stringifyBlingErrorValue(itemValue)
      if (!parsedValue) return null
      return `${key}: ${parsedValue}`
    })
    .filter((item): item is string => Boolean(item))

  if (entries.length > 0) {
    return entries.join(' | ')
  }

  try {
    return JSON.stringify(objectValue)
  } catch {
    return null
  }
}

function getBlingErrorMessage (data: unknown, status: number) {
  const parsedMessage = stringifyBlingErrorValue(data)
  return parsedMessage || `bling_request_failed_${status}`
}

/**
 * Normaliza o ID numérico do Bling vindo do banco (trim, espaços invisíveis, "16619319888.0" → inteiro).
 */
export function normalizeBlingProductId (raw: string | null | undefined): string {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')
  s = s.replace(/\s+/g, '')
  if (!s) return ''
  if (/^\d+\.\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n))
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return String(Math.trunc(n))
  }
  return s
}

/** Caminho API v3: `/produtos/{id}` ou `/produtos/{id}/estoque` etc. */
export function blingProdutoApiPath (blingId: string, subpath?: string): string {
  const id = normalizeBlingProductId(blingId)
  const extra = subpath
    ? (subpath.startsWith('/') ? subpath : `/${subpath}`)
    : ''
  return `/produtos/${encodeURIComponent(id)}${extra}`
}

/**
 * Margem para renovar o access token **antes** de expirar (evita 401 em chamadas e webhooks).
 * Padrão: 30 minutos. Pode sobrescrever com `BLING_ACCESS_TOKEN_REFRESH_MARGIN_MINUTES` (env).
 */
function getProactiveRefreshMarginMs (): number {
  const raw = process.env.BLING_ACCESS_TOKEN_REFRESH_MARGIN_MINUTES
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 60_000)
  }
  return 30 * 60_000
}

/**
 * Retorna true se o access token já expirou ou se expira dentro da margem proativa (renovar agora).
 */
export function shouldRefreshBlingAccessToken (expiresAt: string | null, marginMs?: number): boolean {
  const margin = marginMs ?? getProactiveRefreshMarginMs()
  if (!expiresAt) return true
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return true
  return expiry <= Date.now() + margin
}

export async function getBlingConnectionForCurrentUser (): Promise<BlingConnectionCurrentResult> {
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
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'bling_not_connected' as const }
  }

  return { ok: true as const, connection: data as HubConnection }
}

export async function getBlingConnectionById (id: string): Promise<BlingConnectionByIdResult> {
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

type BlingTokenRefreshResult =
  | { ok: true, connection: HubConnection }
  | { ok: false, error: string }

type PerformBlingTokenRefreshOptions = {
  /** Para cron/rotinas sem cookie de usuário — use service role para passar RLS no `hub_connections`. */
  supabase?: SupabaseClient
}

function isInvalidGrantRefreshError (error: string) {
  const normalized = String(error || '').toLowerCase()
  return normalized.includes('invalid_grant')
}

async function setBlingReconnectRequired (
  supabase: SupabaseClient,
  connection: HubConnection,
  error: string
) {
  const previousMetadata = (connection.metadata && typeof connection.metadata === 'object')
    ? connection.metadata
    : {}

  await supabase
    .from('hub_connections')
    .update({
      metadata: {
        ...previousMetadata,
        blingReconnectRequired: true,
        blingReconnectReason: 'invalid_grant',
        blingReconnectAt: new Date().toISOString(),
        blingLastRefreshError: error,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
}

async function requestBlingTokenRefresh (refreshToken: string) {
  const clientId = process.env.BLING_CLIENT_ID
  const clientSecret = process.env.BLING_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { ok: false as const, error: 'bling_oauth_not_configured' }
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
      refresh_token: refreshToken,
    }),
  })

  const data = (await res.json().catch(() => null)) as BlingTokenResponse | null
  if (!res.ok || !data?.access_token) {
    const errMsg = getBlingErrorMessage(data, res.status)
    return { ok: false as const, error: `refresh_failed_http_${res.status}: ${errMsg}` }
  }

  return { ok: true as const, data }
}

/**
 * Renova o access token no Bling usando o refresh_token e persiste no banco.
 */
export async function performBlingTokenRefresh (
  connection: HubConnection,
  options?: PerformBlingTokenRefreshOptions
): Promise<BlingTokenRefreshResult> {
  if (!connection.refresh_token) {
    return { ok: false, error: 'no_refresh_token' }
  }

  const supabase = options?.supabase ?? await createSupabaseServerClient()
  const firstAttempt = await requestBlingTokenRefresh(connection.refresh_token)

  let sourceConnection = connection
  let tokenData: BlingTokenResponse | null = null

  if (firstAttempt.ok) {
    tokenData = firstAttempt.data
  } else {
    const looksLikeInvalidGrant = isInvalidGrantRefreshError(firstAttempt.error)
    if (!looksLikeInvalidGrant) {
      return { ok: false, error: firstAttempt.error }
    }

    // Pode ocorrer corrida entre cron e requests da aplicação.
    // Se outro fluxo já rotacionou o refresh_token, tentamos 1x com o token mais novo salvo.
    const { data: latest, error: latestError } = await supabase
      .from('hub_connections')
      .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
      .eq('id', connection.id)
      .maybeSingle()

    if (latestError || !latest) {
      await setBlingReconnectRequired(supabase, connection, firstAttempt.error)
      return { ok: false, error: firstAttempt.error }
    }

    const latestConnection = latest as HubConnection
    if (
      !latestConnection.refresh_token
      || latestConnection.refresh_token === connection.refresh_token
    ) {
      await setBlingReconnectRequired(supabase, latestConnection, firstAttempt.error)
      return { ok: false, error: firstAttempt.error }
    }

    const retryAttempt = await requestBlingTokenRefresh(latestConnection.refresh_token)
    if (!retryAttempt.ok) {
      if (isInvalidGrantRefreshError(retryAttempt.error)) {
        await setBlingReconnectRequired(supabase, latestConnection, retryAttempt.error)
      }
      return { ok: false, error: retryAttempt.error }
    }

    sourceConnection = latestConnection
    tokenData = retryAttempt.data
  }

  if (!tokenData?.access_token) {
    return { ok: false, error: 'refresh_failed_no_access_token' }
  }

  const expiresIn = Number(tokenData.expires_in) || 3600
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('hub_connections')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || sourceConnection.refresh_token,
      token_expires_at: tokenExpiresAt,
      metadata: {
        ...(sourceConnection.metadata || {}),
        scope: tokenData.scope || (sourceConnection.metadata as { scope?: string } | null)?.scope || null,
        blingReconnectRequired: false,
        blingReconnectReason: null,
        blingReconnectAt: null,
        blingLastRefreshError: null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .eq('refresh_token', sourceConnection.refresh_token)
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .maybeSingle()

  if (updateError) {
    return { ok: false, error: `db_update_failed: ${updateError.message || 'unknown'}` }
  }

  if (!updated) {
    const { data: latest } = await supabase
      .from('hub_connections')
      .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
      .eq('id', connection.id)
      .maybeSingle()

    if (latest) {
      return { ok: true, connection: latest as HubConnection }
    }
    return { ok: false, error: 'db_update_failed' }
  }

  return { ok: true, connection: updated as HubConnection }
}

export async function refreshBlingTokenIfNeeded (
  connection: HubConnection,
  options?: PerformBlingTokenRefreshOptions
) {
  if (!connection.refresh_token || !shouldRefreshBlingAccessToken(connection.token_expires_at)) {
    return connection
  }

  const result = await performBlingTokenRefresh(connection, options)
  return result.ok ? result.connection : connection
}

/** Força renovação (ex.: botão na tela de integração), mesmo se o token ainda não estiver expirado. */
export async function forceRefreshBlingToken (
  connection: HubConnection,
  options?: PerformBlingTokenRefreshOptions
): Promise<BlingTokenRefreshResult> {
  return performBlingTokenRefresh(connection, options)
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
      const rawMsg = getBlingErrorMessage(data, res.status) || `Erro HTTP ${res.status}`
      const notFoundText = rawMsg.toLowerCase().includes('não encontrad') || rawMsg.toLowerCase().includes('nao encontrad')
      if (res.status === 404 || (res.status === 400 && notFoundText)) {
        const isProduto = options.path.startsWith('/produtos/')
        const hint = isProduto
          ? ' Verifique no Conectize se o campo "ID Bling" é o mesmo do cadastro no Bling (produto ou variação), se o item não foi excluído e se o HUB está conectado à empresa correta.'
          : ''
        throw new Error(`${rawMsg}${hint}`)
      }
      throw new Error(rawMsg)
    }

    return data as T
  }

  return { request }
}

export async function getBlingClientForCurrentUser (): Promise<BlingClientCurrentResult> {
  const result = await getBlingConnectionForCurrentUser()
  if (!result.ok) {
    return { ok: false, error: 'error' in result ? result.error : 'bling_not_connected' }
  }
  const client = await createBlingClientFromConnection(result.connection)
  return { ok: true as const, client, connection: result.connection }
}

export async function getBlingClientByConnectionId (connectionId: string): Promise<BlingClientByIdResult> {
  const result = await getBlingConnectionById(connectionId)
  if (!result.ok) {
    return { ok: false, error: 'error' in result ? result.error : 'bling_connection_not_found' }
  }
  const client = await createBlingClientFromConnection(result.connection)
  return { ok: true as const, client, connection: result.connection }
}


