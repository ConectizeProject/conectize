import { describe, expect, it } from 'vitest'
import { resolveBlingAppCredentials } from '@/lib/integrations/bling/app-credentials'

describe('resolveBlingAppCredentials', () => {
  const env = { clientId: 'env-id', clientSecret: 'env-secret' }

  it('usa Client ID e secret da conexão', () => {
    const creds = resolveBlingAppCredentials({
      metadata: { blingClientId: 'org-id' },
      api_key: 'org-secret',
    }, env)

    expect(creds).toEqual({
      clientId: 'org-id',
      clientSecret: 'org-secret',
      source: 'connection',
    })
  })

  it('não mistura Client ID da conexão com o aplicativo do servidor', () => {
    const creds = resolveBlingAppCredentials({
      metadata: { blingClientId: 'org-id' },
      api_key: '',
    }, env)

    expect(creds).toBeNull()
  })

  it('usa o aplicativo do servidor quando a conexão não tem credenciais', () => {
    const creds = resolveBlingAppCredentials({ metadata: {}, api_key: null }, env)
    expect(creds?.source).toBe('env')
    expect(creds?.clientId).toBe('env-id')
  })
})
