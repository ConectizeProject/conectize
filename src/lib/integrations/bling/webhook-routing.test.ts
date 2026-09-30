import { describe, expect, it } from 'vitest'
import { matchBlingWebhookConnection } from '@/lib/integrations/bling/webhook-routing'

function verifyExact (_raw: string, signature: string | null, secret: string) {
  return signature === `sig:${secret}`
}

describe('matchBlingWebhookConnection', () => {
  const rawBody = '{"companyId":"42"}'

  it('aceita só a conexão cujo empresaId e secret batem', () => {
    const result = matchBlingWebhookConnection([
      {
        id: 'a',
        organization_id: 'org-a',
        api_key: 'secret-a',
        metadata: { empresaId: '99' },
      },
      {
        id: 'b',
        organization_id: 'org-b',
        api_key: 'secret-b',
        metadata: { empresaId: '42' },
      },
    ], {
      companyId: '42',
      rawBody,
      signatureHeader: 'sig:secret-b',
      verifySignature: verifyExact,
    })

    expect(result.ok).toBe(true)
    if (result.ok === true) expect(result.connection.organization_id).toBe('org-b')
  })

  it('não atribui o evento à única conexão sem empresaId', () => {
    const result = matchBlingWebhookConnection([
      {
        id: 'only',
        organization_id: 'org-only',
        api_key: 'secret',
        metadata: {},
      },
    ], {
      companyId: '42',
      rawBody,
      signatureHeader: 'sig:secret',
      verifySignature: verifyExact,
    })

    expect(result).toEqual({ ok: false, reason: 'organization_unresolved' })
  })

  it('rejeita quando mais de uma conexão valida a assinatura', () => {
    const result = matchBlingWebhookConnection([
      {
        id: 'a',
        organization_id: 'org-a',
        api_key: 'shared',
        metadata: { companyId: '42' },
      },
      {
        id: 'b',
        organization_id: 'org-b',
        api_key: 'shared',
        metadata: { empresaId: '42' },
      },
    ], {
      companyId: '042',
      rawBody,
      signatureHeader: 'sig:shared',
      verifySignature: verifyExact,
    })

    expect(result).toEqual({ ok: false, reason: 'ambiguous_organization' })
  })

  it('usa o secret do ambiente só na conexão sem secret próprio e com empresaId igual', () => {
    const result = matchBlingWebhookConnection([
      {
        id: 'legacy',
        organization_id: 'org-legacy',
        api_key: null,
        metadata: { empresaId: '42' },
      },
      {
        id: 'other',
        organization_id: 'org-other',
        api_key: null,
        metadata: { empresaId: '7' },
      },
    ], {
      companyId: '42',
      rawBody,
      signatureHeader: 'sig:env-secret',
      envClientSecret: 'env-secret',
      verifySignature: verifyExact,
    })

    expect(result.ok).toBe(true)
    if (result.ok === true) expect(result.connection.id).toBe('legacy')
  })

  it('não usa o secret do ambiente quando a conexão já tem secret próprio', () => {
    const result = matchBlingWebhookConnection([
      {
        id: 'own',
        organization_id: 'org-own',
        api_key: 'own-secret',
        metadata: { empresaId: '42' },
      },
    ], {
      companyId: '42',
      rawBody,
      signatureHeader: 'sig:env-secret',
      envClientSecret: 'env-secret',
      verifySignature: verifyExact,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })
})
