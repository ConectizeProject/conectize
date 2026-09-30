export type BlingAppCredentials = {
  clientId: string
  clientSecret: string
  source: 'connection' | 'env'
}

type BlingAppCredentialSource = {
  metadata?: unknown
  api_key?: string | null
} | null | undefined

type BlingAppEnvCredentials = {
  clientId?: string | null
  clientSecret?: string | null
}

export function blingClientIdFromMetadata (metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).blingClientId
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

/**
 * Credenciais do aplicativo Bling da organização.
 * Se a conexão já tem Client ID, não usa o aplicativo fixo do servidor.
 */
export function resolveBlingAppCredentials (
  connection: BlingAppCredentialSource,
  env: BlingAppEnvCredentials = {
    clientId: process.env.BLING_CLIENT_ID,
    clientSecret: process.env.BLING_CLIENT_SECRET,
  },
): BlingAppCredentials | null {
  const clientId = blingClientIdFromMetadata(connection?.metadata)
  const clientSecret = String(connection?.api_key || '').trim()

  if (clientId && clientSecret) {
    return { clientId, clientSecret, source: 'connection' }
  }

  if (clientId || clientSecret) return null

  const envClientId = String(env.clientId || '').trim()
  const envClientSecret = String(env.clientSecret || '').trim()
  if (!envClientId || !envClientSecret) return null

  return {
    clientId: envClientId,
    clientSecret: envClientSecret,
    source: 'env',
  }
}
