import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPortalAuthCallbackUrl } from '@/lib/auth/callback-url'

describe('buildPortalAuthCallbackUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('monta URL absoluta com redirectTo codificado', () => {
    const u = buildPortalAuthCallbackUrl('/portal/ordens', 'https://app.example.com')
    expect(u).toBe(
      'https://app.example.com/portal/auth/callback?redirectTo=%2Fportal%2Fordens'
    )
  })

  it('lança quando não há origem (SSR sem window)', () => {
    expect(() => buildPortalAuthCallbackUrl('/portal', '')).toThrow(
      /origem do site indisponível/
    )
  })

  it('usa window.location.origin quando siteOrigin vazio e window existe', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://client.example.com' },
    })
    const u = buildPortalAuthCallbackUrl('/portal', '')
    expect(u).toBe(
      'https://client.example.com/portal/auth/callback?redirectTo=%2Fportal'
    )
  })
})
