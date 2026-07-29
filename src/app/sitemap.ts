import type { MetadataRoute } from 'next'
import { geoLandingPages } from '@/lib/data/geo-landing-pages'
import { brands, services } from '@/lib/data/services'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'
import { listServiceHubs } from '@/lib/utils/service-hubs'
import { getSiteUrl } from '@/lib/utils/site-url'

export default function sitemap (): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()
  const lastModified = new Date()
  
  const routes: MetadataRoute.Sitemap = [
    // Página principal
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    // Páginas principais
    {
      url: `${baseUrl}/servicos`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/coleta`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sobre`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/acessorios`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lojistas`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contato`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/manual/bling`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...geoLandingPages.map((page) => ({
      url: `${baseUrl}/${page.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ]
  
  // Adicionar páginas de serviços (nova semântica: serviço + marca + modelo em slug único)
  for (const service of services) {
    for (const brandSlug of service.brands) {
      const brand = brands[brandSlug]
      if (!brand) continue

      const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []
      const seenModels = new Set<string>()

      for (const deviceType of Object.values(brand.deviceTypes)) {
        if (excludedTypes.includes(deviceType.slug)) continue

        for (const modelSlug of deviceType.models) {
          // Evita duplicar a URL do hub quando um modelo tem o mesmo slug do deviceType (ex.: ipad)
          if (brand.deviceTypes?.[modelSlug]) continue
          if (seenModels.has(modelSlug)) continue
          seenModels.add(modelSlug)

          routes.push({
            url: `${baseUrl}/servicos/${buildServiceProductSlug({ serviceSlug: service.slug, brandSlug, modelSlug })}`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.6,
          })
        }
      }
    }
  }

  // Hubs serviço + marca + dispositivo (elo de descoberta das páginas de modelo)
  for (const hub of listServiceHubs()) {
    routes.push({
      url: `${baseUrl}${hub.href}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return routes
}
