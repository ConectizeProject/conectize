import { describe, expect, it } from 'vitest'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'

describe('assertSafePortalPath', () => {
  it('usa /portal quando ausente ou vazio', () => {
    expect(assertSafePortalPath(undefined)).toBe('/portal')
    expect(assertSafePortalPath(null)).toBe('/portal')
    expect(assertSafePortalPath('')).toBe('/portal')
    expect(assertSafePortalPath('   ')).toBe('/portal')
  })

  it('mantém caminhos que começam com /portal', () => {
    expect(assertSafePortalPath('/portal')).toBe('/portal')
    expect(assertSafePortalPath('/portal/ordens')).toBe('/portal/ordens')
  })

  it('rejeita origem externa e cai em /portal', () => {
    expect(assertSafePortalPath('https://evil.com/portal')).toBe('/portal')
    expect(assertSafePortalPath('//evil.com')).toBe('/portal')
    expect(assertSafePortalPath('/admin')).toBe('/portal')
  })
})
