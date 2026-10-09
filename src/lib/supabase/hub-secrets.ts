import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const HUB_PUBLIC_COLUMNS =
  'id, organization_id, platform_id, token_expires_at, metadata, created_by, created_at, updated_at'

export const HUB_SECRETS_SELECT =
  `${HUB_PUBLIC_COLUMNS}, access_token, refresh_token, api_key`

/**
 * Leitor de access_token / refresh_token / api_key.
 * JWT autenticado não tem SELECT nessas colunas; só service_role lê os secrets.
 * Em testes (VITEST) reusa o client injetado para mocks.
 */
export function resolveHubSecretsReader (fallback?: SupabaseClient): SupabaseClient {
  if (process.env.VITEST && fallback) return fallback
  try {
    return createSupabaseServiceClient()
  } catch (err) {
    if (fallback) return fallback
    throw err
  }
}

export function requireHubOrganizationId (organizationId: string | null | undefined): string {
  const id = String(organizationId || '').trim()
  if (!id) {
    throw new Error('hub_secrets_organization_required')
  }
  return id
}
