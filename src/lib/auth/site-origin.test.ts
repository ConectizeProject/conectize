import { describe, expect, it } from 'vitest'
import { getAuthSiteOrigin, resolveAuthSiteOrigin } from '@/lib/auth/site-origin'

describe('resolveAuthSiteOrigin', () => {
  it('usa liveOrigin quando env ausente', () => {
    expect(resolveAuthSiteOrigin(undefined, 'https://app.com')).toBe('https://app.com')
  })

  it('usa liveOrigin quando env vazio após trim', () => {
    expect(resolveAuthSiteOrigin('   ', 'https://app.com')).toBe('https://app.com')
  })

  it('usa env quando o origin coincide com liveOrigin', () => {
    expect(
      resolveAuthSiteOrigin('https://app.com', 'https://app.com')
    ).toBe('https://app.com')
  })

  it('remove barra final do env antes de comparar', () => {
    expect(
      resolveAuthSiteOrigin('https://app.com/', 'https://app.com')
    ).toBe('https://app.com')
  })

  it('usa liveOrigin quando env aponta para outro host (ex.: localhost vs produção)', () => {
    expect(
      resolveAuthSiteOrigin('http://localhost:3000', 'https://prod.example.com')
    ).toBe('https://prod.example.com')
  })

  it('usa liveOrigin quando env é URL inválida', () => {
    expect(resolveAuthSiteOrigin('not-a-url', 'https://ok.com')).toBe('https://ok.com')
  })

  it('diferencia www e apex (hosts diferentes)', () => {
    expect(
      resolveAuthSiteOrigin('https://www.example.com', 'https://example.com')
    ).toBe('https://example.com')
  })
})

describe('getAuthSiteOrigin', () => {
  it('retorna string vazia sem window (SSR)', () => {
    expect(getAuthSiteOrigin()).toBe('')
  })
})
