import type { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  fetchBlingCompanyProfile,
  mergeBlingCompanyProfileMetadata,
} from '@/lib/integrations/bling/company-profile'
import {
  blingCompanyIdsMatch,
  hubConnectionCompanyId,
  normalizeBlingCompanyId,
  withBlingCompanyIdMetadata,
} from '@/lib/integrations/bling/hub-company-id'

const PLATFORM_ID = 'bling'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

type HubConnectionRow = {
  id: string
  organization_id: string
  access_token: string | null
  metadata: unknown
}

async function listBlingConnections (supabase: ServiceClient): Promise<HubConnectionRow[]> {
  const { data } = await supabase
    .from('hub_connections')
    .select('id, organization_id, access_token, metadata')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(50)

  return (data || []) as HubConnectionRow[]
}

async function persistConnectionCompanyId (
  supabase: ServiceClient,
  connection: HubConnectionRow,
  companyId: string,
): Promise<void> {
  const previous = connection.metadata && typeof connection.metadata === 'object'
    ? (connection.metadata as Record<string, unknown>)
    : {}

  await supabase
    .from('hub_connections')
    .update({
      metadata: withBlingCompanyIdMetadata(previous, companyId),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
}

/**
 * Resolve org pelo companyId do webhook, com backfill seguro quando metadata está incompleta.
 * Só chamar após assinatura HMAC válida (ou dev sem secret).
 */
export async function resolveBlingWebhookOrganizationId (
  supabase: ServiceClient,
  companyIdRaw: string | null,
): Promise<string | null> {
  const companyId = normalizeBlingCompanyId(companyIdRaw)
  if (!companyId) return null

  const connections = await listBlingConnections(supabase)

  for (const row of connections) {
    const stored = hubConnectionCompanyId(row.metadata)
    if (stored && blingCompanyIdsMatch(stored, companyId) && row.organization_id) {
      return String(row.organization_id)
    }
  }

  for (const row of connections) {
    if (hubConnectionCompanyId(row.metadata)) continue
    const token = String(row.access_token || '').trim()
    if (!token) continue

    const profile = await fetchBlingCompanyProfile(token)
    const profileId = normalizeBlingCompanyId(profile?.empresaId)
    if (!profileId) continue

    const previous = row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {}

    await supabase
      .from('hub_connections')
      .update({
        metadata: mergeBlingCompanyProfileMetadata(previous, {
          empresaId: profileId,
          nome: profile?.nome ?? null,
          email: profile?.email ?? null,
          cnpj: profile?.cnpj ?? null,
          logoUrl: profile?.logoUrl ?? null,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (blingCompanyIdsMatch(profileId, companyId) && row.organization_id) {
      return String(row.organization_id)
    }
  }

  if (connections.length === 1 && connections[0].organization_id) {
    await persistConnectionCompanyId(supabase, connections[0], companyId)
    return String(connections[0].organization_id)
  }

  return null
}

export { normalizeBlingCompanyId as normalizeBlingWebhookCompanyId }
