import { describe, expect, it } from 'vitest'
import { listServiceHubs } from '@/lib/utils/service-hubs'

describe('listServiceHubs', () => {
  it('includes apple iphone screen hub', () => {
    const hubs = listServiceHubs({ brandSlug: 'apple', serviceSlug: 'troca-de-tela' })
    expect(hubs.some((hub) => hub.href === '/servicos/troca-de-tela-apple-iphone')).toBe(true)
  })

  it('excludes watch for troca-de-conector when configured', () => {
    const hubs = listServiceHubs({ brandSlug: 'apple', serviceSlug: 'troca-de-conector' })
    expect(hubs.some((hub) => hub.deviceTypeSlug === 'watch')).toBe(false)
  })

  it('covers all brands without hardcoded slice', () => {
    const hubs = listServiceHubs()
    const brands = new Set(hubs.map((hub) => hub.brandSlug))
    expect(brands.has('apple')).toBe(true)
    expect(brands.has('samsung')).toBe(true)
    expect(brands.has('motorola')).toBe(true)
    expect(brands.has('xiaomi')).toBe(true)
    expect(brands.has('lg')).toBe(true)
    expect(hubs.length).toBeGreaterThan(14)
  })
})
