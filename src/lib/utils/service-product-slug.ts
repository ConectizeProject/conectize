import { brands, services } from '@/lib/data/services'

type ParsedProductSlug =
  | { isValid: false }
  | { isValid: true; serviceSlug: string; brandSlug: string; modelSlug: string }

/** Rótulos de tipo que já apareceram colados no slug (slug ou display name). */
export const SERVICE_DEVICE_LABELS: Array<{ slug: string, labels: string[] }> = [
  { slug: 'smartphone', labels: ['smartphone'] },
  { slug: 'tablet', labels: ['tablet'] },
  { slug: 'iphone', labels: ['iphone'] },
  { slug: 'ipad', labels: ['ipad'] },
  { slug: 'macbook', labels: ['macbook'] },
  { slug: 'watch', labels: ['watch', 'apple watch', 'apple-watch'] },
]

export function deviceSlugFromLabel (value: string): string | null {
  const key = value.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const device of SERVICE_DEVICE_LABELS) {
    if (device.labels.includes(key)) return device.slug
  }
  return null
}

/**
 * Impede que o slug nasça com o tipo duplicado (`smartphone-Smartphone`)
 * ou com o display name no lugar do slug (`Smartphone`, `iPhone`).
 */
export function normalizeServiceModelSlug (modelSlug: string): string {
  const raw = modelSlug.trim()
  const direct = deviceSlugFromLabel(raw)
  if (direct) return direct

  const lower = raw.toLowerCase()
  for (const device of SERVICE_DEVICE_LABELS) {
    for (const label of device.labels) {
      const tail = `-${label}`
      if (!lower.endsWith(tail)) continue
      const prefix = raw.slice(0, raw.length - tail.length)
      const prefixLower = prefix.toLowerCase()
      if (prefixLower === device.slug || prefixLower.endsWith(`-${device.slug}`)) {
        return prefix
      }
    }
  }

  return raw
}

export function buildServiceProductSlug (input: { serviceSlug: string; brandSlug: string; modelSlug: string }) {
  return `${input.serviceSlug}-${input.brandSlug}-${normalizeServiceModelSlug(input.modelSlug)}`
}

function getServiceSlugsSorted () {
  return services
    .map(s => s.slug)
    .slice()
    .sort((a, b) => b.length - a.length)
}

export function parseServiceProductSlug (slug: string): ParsedProductSlug {
  if (!slug) return { isValid: false }

  const serviceSlugs = getServiceSlugsSorted()
  const serviceSlug = serviceSlugs.find(s => slug === s || slug.startsWith(`${s}-`))
  if (!serviceSlug) return { isValid: false }

  const restAfterService = slug === serviceSlug ? '' : slug.slice(serviceSlug.length + 1)
  if (!restAfterService) return { isValid: false }

  const brandSlugs = Object.keys(brands).sort((a, b) => b.length - a.length)
  const brandSlug = brandSlugs.find(b => restAfterService === b || restAfterService.startsWith(`${b}-`))
  if (!brandSlug) return { isValid: false }

  const modelSlug = restAfterService === brandSlug ? '' : restAfterService.slice(brandSlug.length + 1)
  if (!modelSlug) return { isValid: false }

  return { isValid: true, serviceSlug, brandSlug, modelSlug }
}

