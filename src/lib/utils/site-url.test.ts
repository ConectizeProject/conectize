import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANONICAL_SITE_ORIGIN, getSiteUrl } from '@/lib/utils/site-url'

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to www canonical origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('normalizes apex production host to www', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://conectize.com.br')
    expect(getSiteUrl()).toBe('https://www.conectize.com.br')
  })

  it('preserves localhost for development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })
})
