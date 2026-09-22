import { brands, getBrandBySlug, getModelBySlugAnyType, getServiceBySlug, services } from '@/lib/data/services'
import { buildServiceProductSlug, parseServiceProductSlug } from '@/lib/utils/service-product-slug'

const serviceSlugs = new Set(services.map((s) => s.slug))
const brandSlugs = new Set(Object.keys(brands))

/** Nome de tipo colado em maiúscula no fim de um slug que já termina com o tipo. */
const DUPLICATED_DEVICE_LABEL = /-(Smartphone|Tablet|iPhone|iPad|MacBook)$/

function isIndexableServiceSlug (slug: string): boolean {
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

function resolveDuplicatedDeviceSuffix (slug: string): string | null {
  const match = slug.match(DUPLICATED_DEVICE_LABEL)
  if (!match) return null

  const prefix = slug.slice(0, -match[0].length)
  const label = match[1].toLowerCase()
  if (!prefix.endsWith(`-${label}`)) return null
  if (!isIndexableServiceSlug(prefix)) return null

  return `/servicos/${prefix}`
}

/**
 * Resolve URLs legadas de /servicos/* para o destino canônico.
 * Retorna path (+ search) relativo, ou null se não houver mapeamento.
 */
export function resolveLegacyServiceDestination (segments: string[]): string | null {
  if (segments.length === 0) return null

  // /servicos/<servico> → hub
  if (segments.length === 1) {
    const slug = segments[0]
    if (serviceSlugs.has(slug)) return `/servicos?servico=${encodeURIComponent(slug)}`
    return resolveDuplicatedDeviceSuffix(slug)
  }

  // /servicos/<marca>/<servico>/<modelo>
  if (segments.length === 3) {
    const [a, b, c] = segments
    if (brandSlugs.has(a) && serviceSlugs.has(b)) {
      return `/servicos/${buildServiceProductSlug({
        serviceSlug: b,
        brandSlug: a,
        modelSlug: c,
      })}`
    }
    // /servicos/<servico>/<marca>/<tipo> → hub
    if (serviceSlugs.has(a) && brandSlugs.has(b)) {
      return `/servicos?marca=${encodeURIComponent(b)}&servico=${encodeURIComponent(a)}`
    }
  }

  // /servicos/<marca>/<servico>
  if (segments.length === 2) {
    const [a, b] = segments
    if (brandSlugs.has(a) && serviceSlugs.has(b)) {
      return `/servicos?marca=${encodeURIComponent(a)}&servico=${encodeURIComponent(b)}`
    }
    if (serviceSlugs.has(a) && brandSlugs.has(b)) {
      return `/servicos?marca=${encodeURIComponent(b)}&servico=${encodeURIComponent(a)}`
    }
  }

  // /servicos/<servico>/<marca>/<tipo>/<modelo>
  if (segments.length === 4) {
    const [servico, marca, _tipo, modelo] = segments
    if (serviceSlugs.has(servico) && brandSlugs.has(marca)) {
      return `/servicos/${buildServiceProductSlug({
        serviceSlug: servico,
        brandSlug: marca,
        modelSlug: modelo,
      })}`
    }
  }

  return null
}
