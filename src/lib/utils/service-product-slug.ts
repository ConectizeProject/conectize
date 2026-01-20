import { brands, services } from '@/lib/data/services'

type ParsedProductSlug =
  | { isValid: false }
  | { isValid: true; serviceSlug: string; brandSlug: string; modelSlug: string }

export function buildServiceProductSlug (input: { serviceSlug: string; brandSlug: string; modelSlug: string }) {
  return `${input.serviceSlug}-${input.brandSlug}-${input.modelSlug}`
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

