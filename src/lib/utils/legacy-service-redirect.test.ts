import { describe, expect, it } from 'vitest'
import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'

describe('resolveLegacyServiceDestination', () => {
  it('redirects brand/service/model to canonical slug', () => {
    expect(
      resolveLegacyServiceDestination(['samsung', 'troca-de-bateria', 'galaxy-a54'])
    ).toBe('/servicos/troca-de-bateria-samsung-galaxy-a54')
  })

  it('redirects brand/service hub', () => {
    expect(
      resolveLegacyServiceDestination(['apple', 'reparo-de-placa'])
    ).toBe('/servicos?marca=apple&servico=reparo-de-placa')
  })

  it('redirects service/brand/type/model to canonical slug', () => {
    expect(
      resolveLegacyServiceDestination(['troca-de-tela', 'apple', 'iphone', 'iphone-12-pro'])
    ).toBe('/servicos/troca-de-tela-apple-iphone-12-pro')
  })

  it('returns null for canonical product slug', () => {
    expect(
      resolveLegacyServiceDestination(['troca-de-bateria-samsung-galaxy-a54'])
    ).toBeNull()
  })
})
