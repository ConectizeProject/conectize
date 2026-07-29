import { brands, services } from '@/lib/data/services'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'

const serviceSlugs = new Set(services.map((s) => s.slug))
const brandSlugs = new Set(Object.keys(brands))

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
    return null
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
