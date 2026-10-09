import { brands, getModelBySlugAnyType, services } from '@/lib/data/services'
import { ASSISTENCIA_IPHONE_PATH } from '@/lib/marketing/iphone-pillars'
import {
  closestCanonicalServicePath,
  indexableServicePath,
} from '@/lib/utils/canonical-service-path'
import {
  SERVICE_DEVICE_LABELS,
  deviceSlugFromLabel,
} from '@/lib/utils/service-product-slug'
import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

const serviceSlugs = new Set(services.map((service) => service.slug))
const brandSlugs = new Set(Object.keys(brands))
const serviceSlugsByLength = services
  .map((service) => service.slug)
  .slice()
  .sort((a, b) => b.length - a.length)

function decodeSegment (segment: string): string {
  try {
    return decodeURIComponent(segment).trim()
  } catch {
    return segment.trim()
  }
}

function legacyDeviceSuffixPath (slug: string): string | null {
  const lower = slug.toLowerCase()
  for (const device of SERVICE_DEVICE_LABELS) {
    for (const label of device.labels) {
      const tail = `-${label}`
      if (!lower.endsWith(tail)) continue
      const prefix = slug.slice(0, slug.length - tail.length)
      const prefixLower = prefix.toLowerCase()
      if (prefixLower === device.slug || prefixLower.endsWith(`-${device.slug}`)) {
        const path = indexableServicePath(prefix)
        if (path) return path
      }
      const rewritten = `${prefix}-${device.slug}`
      if (rewritten !== slug) {
        const path = indexableServicePath(rewritten)
        if (path && path !== `/servicos/${slug}`) return path
      }
    }
  }
  return null
}

/** `/servicos/reparo-de-placa-apple` (serviço + marca, sem modelo). */
function compactServiceBrandPath (slug: string): string | null {
  const lower = slug.toLowerCase()
  const serviceSlug = serviceSlugsByLength.find((item) => lower.startsWith(`${item}-`))
  if (!serviceSlug) return null
  const rest = lower.slice(serviceSlug.length + 1)
  if (!brandSlugs.has(rest)) return null
  return closestCanonicalServicePath({ serviceSlug, brandSlug: rest })
}

type ClassifiedSegments = {
  serviceSlug?: string
  brandSlug?: string
  deviceSlug?: string
  modelSlug?: string
}

function classifySegments (segments: string[]): ClassifiedSegments | null {
  let serviceSlug: string | undefined
  let brandSlug: string | undefined
  let deviceSlug: string | undefined
  const unknown: string[] = []

  for (const segment of segments) {
    const lower = segment.toLowerCase()
    if (!serviceSlug && serviceSlugs.has(lower)) {
      serviceSlug = lower
      continue
    }
    if (!brandSlug && brandSlugs.has(lower)) {
      brandSlug = lower
      continue
    }
    const device = deviceSlugFromLabel(segment)
    if (!deviceSlug && device) {
      deviceSlug = device
      continue
    }
    unknown.push(lower)
  }

  if (!serviceSlug || !brandSlug) return null

  let modelSlug: string | undefined
  if (brandSlug) {
    for (const segment of unknown) {
      const model = getModelBySlugAnyType(brandSlug, segment)
      if (model) modelSlug = model.modelSlug
    }
  }

  return { serviceSlug, brandSlug, deviceSlug, modelSlug }
}

/**
 * Resolve URLs legadas de /servicos/* para o path canônico (sem query).
 * Retorna null quando a URL já é canônica ou não há mapeamento (404).
 */
export function resolveLegacyServiceDestination (segments: string[]): string | null {
  if (segments.length === 0) return null

  const decoded = segments.map(decodeSegment).filter(Boolean)
  if (decoded.length === 0) return null

  if (decoded.length === 1) {
    const slug = decoded[0]
    const lower = slug.toLowerCase()
    if (serviceSlugs.has(lower)) return SERVICES_HUB_PATH
    if (lower === 'apple') return ASSISTENCIA_IPHONE_PATH
    if (brandSlugs.has(lower)) return SERVICES_HUB_PATH
    return legacyDeviceSuffixPath(slug) ?? compactServiceBrandPath(slug)
  }

  const classified = classifySegments(decoded)
  if (!classified?.serviceSlug || !classified.brandSlug) return null

  const destination = closestCanonicalServicePath(classified)
  const requested = `/servicos/${decoded.join('/')}`
  if (destination === requested) return null
  return destination
}
