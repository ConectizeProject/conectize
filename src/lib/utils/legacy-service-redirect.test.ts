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
    ).toBe('/conserto-de-celular-belo-horizonte?marca=apple&servico=reparo-de-placa')
  })

  it('redirects single service segment to the services hub', () => {
    expect(
      resolveLegacyServiceDestination(['troca-de-bateria'])
    ).toBe('/conserto-de-celular-belo-horizonte?servico=troca-de-bateria')
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

  it('redirects a duplicated device label glued onto a hub slug', () => {
    expect(
      resolveLegacyServiceDestination(['reparo-de-agua-motorola-smartphone-Smartphone'])
    ).toBe('/servicos/reparo-de-agua-motorola-smartphone')
  })

  it('returns null when the capitalized suffix is not a real page', () => {
    expect(
      resolveLegacyServiceDestination(['reparo-de-agua-motorola-smartphone-iPhone'])
    ).toBeNull()
  })
})
