import { describe, expect, it } from 'vitest'
import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'
import { isIndexableServiceProductSlug } from '@/lib/utils/canonical-service-path'

function expectStable (segments: string[]) {
  const destination = resolveLegacyServiceDestination(segments)
  expect(destination).toBeTruthy()
  expect(destination).not.toContain('?')
  if (!destination?.startsWith('/servicos/')) return
  const rest = destination.slice('/servicos/'.length).split('/').filter(Boolean)
  expect(resolveLegacyServiceDestination(rest)).toBeNull()
  expect(isIndexableServiceProductSlug(rest[0] ?? '')).toBe(true)
}

describe('resolveLegacyServiceDestination', () => {
  it('redirects brand/service/model to the canonical slug in one step', () => {
    expect(
      resolveLegacyServiceDestination(['samsung', 'troca-de-bateria', 'galaxy-a54'])
    ).toBe('/servicos/troca-de-bateria-samsung-galaxy-a54')
    expectStable(['samsung', 'troca-de-bateria', 'galaxy-a54'])
  })

  it('redirects service/brand/model straight to the model page', () => {
    expect(
      resolveLegacyServiceDestination(['troca-de-bateria', 'samsung', 'galaxy-a54'])
    ).toBe('/servicos/troca-de-bateria-samsung-galaxy-a54')
  })

  it('redirects brand/service/type/model that used to 404', () => {
    expect(
      resolveLegacyServiceDestination(['samsung', 'troca-de-bateria', 'smartphone', 'galaxy-a54'])
    ).toBe('/servicos/troca-de-bateria-samsung-galaxy-a54')
    expect(
      resolveLegacyServiceDestination(['apple', 'troca-de-tela', 'iphone', 'iphone-12'])
    ).toBe('/servicos/troca-de-tela-apple-iphone-12')
  })

  it('redirects brand/service with several device types to the catalog', () => {
    expect(
      resolveLegacyServiceDestination(['apple', 'reparo-de-placa'])
    ).toBe('/conserto-de-celular-belo-horizonte')
    expect(
      resolveLegacyServiceDestination(['reparo-de-placa', 'apple'])
    ).toBe('/conserto-de-celular-belo-horizonte')
  })

  it('redirects brand/service with a single device type to that hub', () => {
    expect(
      resolveLegacyServiceDestination(['motorola', 'reparo-de-agua'])
    ).toBe('/servicos/reparo-de-agua-motorola-smartphone')
    expectStable(['motorola', 'reparo-de-agua'])
  })

  it('redirects a service-only segment to the catalog, without filter params', () => {
    expect(
      resolveLegacyServiceDestination(['troca-de-bateria'])
    ).toBe('/conserto-de-celular-belo-horizonte')
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
    expect(
      resolveLegacyServiceDestination(['troca-de-camera-xiaomi-smartphone-Smartphone'])
    ).toBe('/servicos/troca-de-camera-xiaomi-smartphone')
    expect(
      resolveLegacyServiceDestination(['reparo-de-agua-motorola-smartphone-smartphone'])
    ).toBe('/servicos/reparo-de-agua-motorola-smartphone')
  })

  it('redirects a display name used in place of the device slug', () => {
    expect(
      resolveLegacyServiceDestination(['reparo-de-agua-motorola-Smartphone'])
    ).toBe('/servicos/reparo-de-agua-motorola-smartphone')
  })

  it('returns null when the capitalized suffix is not a real page', () => {
    expect(
      resolveLegacyServiceDestination(['reparo-de-agua-motorola-smartphone-iPhone'])
    ).toBeNull()
  })

  it('returns null for a path that does not exist', () => {
    expect(resolveLegacyServiceDestination(['nao-existe-xyz'])).toBeNull()
    expect(resolveLegacyServiceDestination(['foo', 'bar'])).toBeNull()
  })
})
