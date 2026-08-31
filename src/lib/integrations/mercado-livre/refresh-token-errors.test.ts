import { describe, expect, it } from 'vitest'
import {
  meliRefreshTokenErrorToMessage,
  meliSyncFailureMessage,
} from '@/lib/integrations/mercado-livre/refresh-token-errors'

describe('meliRefreshTokenErrorToMessage', () => {
  it('maps invalid_token to a reconnect hint', () => {
    const message = meliRefreshTokenErrorToMessage('invalid_token')
    expect(message.toLowerCase()).toContain('mercado livre')
    expect(message.toLowerCase()).toContain('hub')
    expect(message).not.toBe('invalid_token')
    expect(message.toLowerCase()).not.toContain('bling')
  })

  it('maps refresh_failed_http with invalid_grant to Mercado Livre, not Bling', () => {
    const message = meliRefreshTokenErrorToMessage(
      'refresh_failed_http_400: invalid_grant',
    )
    expect(message.toLowerCase()).toContain('mercado livre')
    expect(message.toLowerCase()).toContain('hub')
    expect(message).not.toContain('invalid_grant')
    expect(message.toLowerCase()).not.toContain('bling')
  })
})

describe('meliSyncFailureMessage', () => {
  it('maps from error code even if message mentions Bling', () => {
    const message = meliSyncFailureMessage({
      error: 'refresh_failed_http_400: invalid_grant',
      message:
        'O refresh token expirou ou foi revogado. Desconecte e conecte o Bling de novo no HUB.',
    })
    expect(message.toLowerCase()).toContain('mercado livre')
    expect(message.toLowerCase()).not.toContain('bling')
  })
})
