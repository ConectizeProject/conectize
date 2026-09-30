import { afterEach, describe, expect, it } from 'vitest'
import {
  MELI_WEBHOOK_SECRET_HEADER,
  readMeliWebhookProvidedSecret,
  verifyMeliWebhookAuth,
} from '@/lib/integrations/mercado-livre/webhook-auth'

const originalSecret = process.env.MELI_WEBHOOK_SECRET

afterEach(() => {
  if (originalSecret == null) delete process.env.MELI_WEBHOOK_SECRET
  else process.env.MELI_WEBHOOK_SECRET = originalSecret
})

function req (url: string, headers?: HeadersInit) {
  return new Request(url, { method: 'POST', headers })
}

describe('verifyMeliWebhookAuth', () => {
  it('falha fechado quando MELI_WEBHOOK_SECRET não está definido', () => {
    delete process.env.MELI_WEBHOOK_SECRET
    const result = verifyMeliWebhookAuth(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook?token=x'),
    )
    expect(result).toEqual({ ok: false, reason: 'secret_not_configured' })
  })

  it('aceita token na query', () => {
    process.env.MELI_WEBHOOK_SECRET = 's3cret-token'
    const result = verifyMeliWebhookAuth(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook?token=s3cret-token'),
    )
    expect(result).toEqual({ ok: true })
  })

  it('aceita header x-meli-webhook-secret', () => {
    process.env.MELI_WEBHOOK_SECRET = 's3cret-token'
    const result = verifyMeliWebhookAuth(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook', {
        [MELI_WEBHOOK_SECRET_HEADER]: 's3cret-token',
      }),
    )
    expect(result).toEqual({ ok: true })
  })

  it('rejeita token errado', () => {
    process.env.MELI_WEBHOOK_SECRET = 's3cret-token'
    const result = verifyMeliWebhookAuth(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook?token=nope'),
    )
    expect(result).toEqual({ ok: false, reason: 'invalid_secret' })
  })

  it('rejeita ausência de token', () => {
    process.env.MELI_WEBHOOK_SECRET = 's3cret-token'
    const result = verifyMeliWebhookAuth(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook'),
    )
    expect(result).toEqual({ ok: false, reason: 'missing_secret' })
  })
})

describe('readMeliWebhookProvidedSecret', () => {
  it('prefere header à query', () => {
    const provided = readMeliWebhookProvidedSecret(
      req('https://www.conectize.com.br/api/portal/mercado-livre/webhook?token=from-query', {
        [MELI_WEBHOOK_SECRET_HEADER]: 'from-header',
      }),
    )
    expect(provided).toBe('from-header')
  })
})
