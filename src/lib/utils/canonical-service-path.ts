import {
  brands,
  getBrandBySlug,
  getModelBySlugAnyType,
  getServiceBySlug,
} from '@/lib/data/services'
import { ASSISTENCIA_IPHONE_PATH } from '@/lib/marketing/iphone-pillars'
import { buildServiceProductSlug, normalizeServiceModelSlug, parseServiceProductSlug } from '@/lib/utils/service-product-slug'
import { listServiceHubs } from '@/lib/utils/service-hubs'
import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

const PREFERRED_BRAND_DEVICE: Array<[string, string]> = [
  ['apple', 'iphone'],
  ['samsung', 'smartphone'],
  ['xiaomi', 'smartphone'],
  ['motorola', 'smartphone'],
  ['lg', 'smartphone'],
]

export function isIndexableServiceProductSlug (slug: string): boolean {
  const parsed = parseServiceProductSlug(slug)
  if (!parsed.isValid) return false

  const service = getServiceBySlug(parsed.serviceSlug)
  const brand = getBrandBySlug(parsed.brandSlug)
  if (!service || !brand || !service.brands.includes(brand.slug)) return false

  const excluded = service.excludedDeviceTypes?.[brand.slug] || []
  const deviceType = brand.deviceTypes?.[parsed.modelSlug]
  if (deviceType) return !excluded.includes(deviceType.slug)

  const model = getModelBySlugAnyType(parsed.brandSlug, parsed.modelSlug)
  if (!model) return false
  return !excluded.includes(model.deviceType.slug)
}

export function indexableServicePath (slug: string): string | null {
  if (isIndexableServiceProductSlug(slug)) return `/servicos/${slug}`
  const lower = slug.toLowerCase()
  if (lower !== slug && isIndexableServiceProductSlug(lower)) return `/servicos/${lower}`
  return null
}

/**
 * Página canônica mais próxima, sem query string.
 * Modelo específico, hub do tipo, hub único da marca ou a listagem.
 */
export function closestCanonicalServicePath (input: {
  serviceSlug?: string
  brandSlug?: string
  deviceSlug?: string
  modelSlug?: string
}): string {
  const serviceSlug = input.serviceSlug?.trim().toLowerCase()
  const brandSlug = input.brandSlug?.trim().toLowerCase()
  const deviceSlug = input.deviceSlug ? normalizeServiceModelSlug(input.deviceSlug).toLowerCase() : undefined
  const modelSlug = input.modelSlug ? normalizeServiceModelSlug(input.modelSlug).toLowerCase() : undefined

  if (serviceSlug && brandSlug && modelSlug && modelSlug !== deviceSlug) {
    const slug = buildServiceProductSlug({ serviceSlug, brandSlug, modelSlug })
    const path = indexableServicePath(slug)
    if (path) return path
  }

  if (serviceSlug && brandSlug && deviceSlug) {
    const slug = buildServiceProductSlug({ serviceSlug, brandSlug, modelSlug: deviceSlug })
    const path = indexableServicePath(slug)
    if (path) return path
  }

  if (serviceSlug && brandSlug) {
    const hubs = listServiceHubs({ serviceSlug, brandSlug })
    if (hubs.length === 1) return hubs[0].href
    return SERVICES_HUB_PATH
  }

  if (serviceSlug) return preferredPublicServiceHref(serviceSlug)
  if (brandSlug === 'apple') return ASSISTENCIA_IPHONE_PATH
  if (brandSlug && brands[brandSlug]) return SERVICES_HUB_PATH
  return SERVICES_HUB_PATH
}

/** Hub em destaque para um serviço genérico (link de navegação, não filtro). */
export function preferredPublicServiceHref (serviceSlug: string): string {
  const hubs = listServiceHubs({ serviceSlug })
  for (const [brandSlug, deviceSlug] of PREFERRED_BRAND_DEVICE) {
    const hub = hubs.find((entry) => entry.brandSlug === brandSlug && entry.deviceTypeSlug === deviceSlug)
    if (hub) return hub.href
  }
  return hubs[0]?.href ?? SERVICES_HUB_PATH
}

/** Página de marca sem query. Apple tem pilar próprio. */
export function preferredPublicBrandHref (brandSlug: string): string {
  if (brandSlug === 'apple') return ASSISTENCIA_IPHONE_PATH
  const hubs = listServiceHubs({ brandSlug, serviceSlug: 'troca-de-tela' })
  const preferred = hubs.find((hub) => hub.deviceTypeSlug === 'smartphone' || hub.deviceTypeSlug === 'iphone')
  return preferred?.href ?? hubs[0]?.href ?? SERVICES_HUB_PATH
}
