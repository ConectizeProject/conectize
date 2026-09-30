import type { createSupabaseServiceClient } from '@/lib/supabase/service'
import { normalizeBlingCompanyId } from '@/lib/integrations/bling/hub-company-id'
import {
  matchBlingWebhookConnection,
  type BlingWebhookCandidate,
  type BlingWebhookMatchResult,
} from '@/lib/integrations/bling/webhook-routing'

const PLATFORM_ID = 'bling'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

export { normalizeBlingCompanyId as normalizeBlingWebhookCompanyId }

function companyIdFilterValue (companyId: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) return null
  return companyId
}

/**
 * Localiza a conexão Bling já vinculada ao companyId do evento e confere a assinatura
 * com o Client Secret dessa conexão. Não grava empresaId a partir do webhook.
 */
export async function resolveBlingWebhookConnection (
  supabase: ServiceClient,
  input: {
    companyId: string | null
    rawBody: string
    signatureHeader: string | null
  },
): Promise<BlingWebhookMatchResult> {
  const companyId = normalizeBlingCompanyId(input.companyId)
  if (!companyId) return { ok: false, reason: 'missing_company_id' }
  if (!String(input.signatureHeader || '').trim()) {
    return { ok: false, reason: 'missing_signature' }
  }

  const filterValue = companyIdFilterValue(companyId)
  if (!filterValue) return { ok: false, reason: 'organization_unresolved' }

  const select = 'id, organization_id, api_key, metadata'
  const [byEmpresa, byCompany] = await Promise.all([
    supabase
      .from('hub_connections')
      .select(select)
      .eq('platform_id', PLATFORM_ID)
      .filter('metadata->>empresaId', 'eq', filterValue),
    supabase
      .from('hub_connections')
      .select(select)
      .eq('platform_id', PLATFORM_ID)
      .filter('metadata->>companyId', 'eq', filterValue),
  ])

  if (byEmpresa.error || byCompany.error) {
    return { ok: false, reason: 'organization_unresolved' }
  }

  const merged = new Map<string, BlingWebhookCandidate>()
  for (const row of [...(byEmpresa.data || []), ...(byCompany.data || [])]) {
    const candidate = row as BlingWebhookCandidate
    if (candidate.id) merged.set(candidate.id, candidate)
  }

  return matchBlingWebhookConnection([...merged.values()], {
    companyId,
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    envClientSecret: process.env.BLING_CLIENT_SECRET,
  })
}
