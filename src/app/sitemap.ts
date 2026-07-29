import type { MetadataRoute } from 'next'
import { geoLandingPages } from '@/lib/data/geo-landing-pages'
import { brands, services } from '@/lib/data/services'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'

export default function sitemap (): MetadataRoute.Sitemap {
  const baseUrl = 'https://conectize.com.br'
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

  // Rotas fixas (serviço + marca + dispositivo) para indexação
  const fixedRoutes: Array<{ serviceSlug: string; brandSlug: string; deviceTypeSlug: string }> = [
    { serviceSlug: 'troca-de-tela', brandSlug: 'apple', deviceTypeSlug: 'iphone' },
    { serviceSlug: 'troca-de-bateria', brandSlug: 'apple', deviceTypeSlug: 'iphone' },
    { serviceSlug: 'troca-de-vidro-da-tela', brandSlug: 'apple', deviceTypeSlug: 'iphone' },
    { serviceSlug: 'troca-de-vidro-tampa-traseira', brandSlug: 'apple', deviceTypeSlug: 'iphone' },
    { serviceSlug: 'troca-de-conector', brandSlug: 'apple', deviceTypeSlug: 'iphone' },
    { serviceSlug: 'troca-de-camera', brandSlug: 'apple', deviceTypeSlug: 'iphone' },

    { serviceSlug: 'troca-de-tela', brandSlug: 'samsung', deviceTypeSlug: 'smartphone' },
    { serviceSlug: 'troca-de-bateria', brandSlug: 'samsung', deviceTypeSlug: 'smartphone' },
    { serviceSlug: 'troca-de-vidro-tampa-traseira', brandSlug: 'samsung', deviceTypeSlug: 'smartphone' },
    { serviceSlug: 'troca-de-camera', brandSlug: 'samsung', deviceTypeSlug: 'smartphone' },

    { serviceSlug: 'troca-de-tela', brandSlug: 'motorola', deviceTypeSlug: 'smartphone' },
    { serviceSlug: 'troca-de-bateria', brandSlug: 'motorola', deviceTypeSlug: 'smartphone' },

    { serviceSlug: 'troca-de-tela', brandSlug: 'xiaomi', deviceTypeSlug: 'smartphone' },
    { serviceSlug: 'troca-de-bateria', brandSlug: 'xiaomi', deviceTypeSlug: 'smartphone' },
  ]

  for (const entry of fixedRoutes) {
    const service = services.find(s => s.slug === entry.serviceSlug)
    const brand = brands[entry.brandSlug]
    const deviceType = brand?.deviceTypes?.[entry.deviceTypeSlug]
    if (!service || !brand || !deviceType) continue

    const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
    if (excludedTypes.includes(deviceType.slug)) continue

    routes.push({
      url: `${baseUrl}/servicos/${buildServiceProductSlug({
        serviceSlug: service.slug,
        brandSlug: brand.slug,
        modelSlug: deviceType.slug
      })}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.75,
    })
  }
  
  return routes
}
