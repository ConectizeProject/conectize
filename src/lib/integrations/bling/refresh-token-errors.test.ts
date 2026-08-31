import { describe, expect, it } from 'vitest'
import { blingRefreshTokenErrorToMessage } from '@/lib/integrations/bling/refresh-token-errors'

describe('blingRefreshTokenErrorToMessage', () => {
  it('maps invalid_token to a reconnect hint', () => {
    const message = blingRefreshTokenErrorToMessage('invalid_token')
    expect(message.toLowerCase()).toContain('bling')
    expect(message.toLowerCase()).toContain('hub')
    expect(message).not.toBe('invalid_token')
  })

  it('maps refresh_failed_http with invalid_token', () => {
    const message = blingRefreshTokenErrorToMessage(
      'refresh_failed_http_401: invalid_token',
    )
    expect(message.toLowerCase()).toContain('hub')
    expect(message).not.toContain('invalid_token')
  })
})
