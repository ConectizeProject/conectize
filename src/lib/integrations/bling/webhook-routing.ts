import {
  blingCompanyIdsMatch,
  hubConnectionCompanyId,
  normalizeBlingCompanyId,
} from '@/lib/integrations/bling/hub-company-id'
import { verifyBlingWebhookSignature } from '@/lib/integrations/bling/webhook-signature'

export type BlingWebhookCandidate = {
  id: string
  organization_id: string
  api_key: string | null
  metadata: unknown
}

export type BlingWebhookMatchFailure =
  | 'missing_company_id'
  | 'missing_signature'
  | 'invalid_signature'
  | 'organization_unresolved'
  | 'ambiguous_organization'

export type BlingWebhookMatchResult =
  | { ok: true, connection: BlingWebhookCandidate }
  | { ok: false, reason: BlingWebhookMatchFailure }

/**
 * Escolhe a única conexão cujo empresaId é o do evento e cuja assinatura bate
 * com o Client Secret dessa linha. Sem conexão única de fallback.
 */
export function matchBlingWebhookConnection (
  candidates: BlingWebhookCandidate[],
  input: {
    companyId: string | null
    rawBody: string
    signatureHeader: string | null
    envClientSecret?: string | null
    verifySignature?: (rawBody: string, signatureHeader: string | null, clientSecret: string) => boolean
  },
): BlingWebhookMatchResult {
  const companyId = normalizeBlingCompanyId(input.companyId)
  if (!companyId) return { ok: false, reason: 'missing_company_id' }

  const signatureHeader = String(input.signatureHeader || '').trim()
  if (!signatureHeader) return { ok: false, reason: 'missing_signature' }

  const verify = input.verifySignature ?? verifyBlingWebhookSignature
  const envSecret = String(input.envClientSecret || '').trim()

  const linked = candidates.filter((row) => {
    if (!row.organization_id) return false
    return blingCompanyIdsMatch(hubConnectionCompanyId(row.metadata), companyId)
  })

  const matches = linked.filter((row) => {
    const ownSecret = String(row.api_key || '').trim()
    if (ownSecret) return verify(input.rawBody, signatureHeader, ownSecret)
    if (!envSecret) return false
    return verify(input.rawBody, signatureHeader, envSecret)
  })

  if (matches.length === 1) return { ok: true, connection: matches[0] }
  if (matches.length > 1) return { ok: false, reason: 'ambiguous_organization' }
  if (linked.length === 0) return { ok: false, reason: 'organization_unresolved' }
  return { ok: false, reason: 'invalid_signature' }
}
