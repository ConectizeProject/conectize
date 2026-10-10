import { describe, expect, it } from 'vitest'
import {
  isIndexableServiceProductSlug,
  preferredPublicBrandHref,
  preferredPublicServiceHref,
} from '@/lib/utils/canonical-service-path'

describe('preferred public service links', () => {
  it('points navigation at a final hub, without filter params', () => {
    for (const serviceSlug of [
      'troca-de-bateria',
      'reparo-de-placa',
      'troca-de-camera',
      'troca-de-vidro-da-tela',
      'reparo-de-agua',
    ]) {
      const href = preferredPublicServiceHref(serviceSlug)
      expect(href.startsWith('/servicos/')).toBe(true)
      expect(href).not.toContain('?')
      expect(isIndexableServiceProductSlug(href.slice('/servicos/'.length))).toBe(true)
    }

    expect(preferredPublicBrandHref('apple')).toBe('/assistencia-apple-bh')
    expect(preferredPublicBrandHref('samsung')).toBe('/servicos/troca-de-tela-samsung-smartphone')
    expect(preferredPublicBrandHref('samsung')).not.toContain('?')
  })
})
