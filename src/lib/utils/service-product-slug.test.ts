import { describe, expect, it } from 'vitest'
import { buildServiceProductSlug, normalizeServiceModelSlug } from '@/lib/utils/service-product-slug'

describe('buildServiceProductSlug', () => {
  it('does not duplicate the generic device label', () => {
    expect(normalizeServiceModelSlug('Smartphone')).toBe('smartphone')
    expect(normalizeServiceModelSlug('smartphone-Smartphone')).toBe('smartphone')
    expect(normalizeServiceModelSlug('iPhone')).toBe('iphone')
    expect(normalizeServiceModelSlug('Apple Watch')).toBe('watch')
    expect(normalizeServiceModelSlug('galaxy-a54')).toBe('galaxy-a54')
    expect(buildServiceProductSlug({
      serviceSlug: 'reparo-de-agua',
      brandSlug: 'motorola',
      modelSlug: 'smartphone-Smartphone',
    })).toBe('reparo-de-agua-motorola-smartphone')
    expect(buildServiceProductSlug({
      serviceSlug: 'troca-de-camera',
      brandSlug: 'xiaomi',
      modelSlug: 'Smartphone',
    })).toBe('troca-de-camera-xiaomi-smartphone')
  })
})
