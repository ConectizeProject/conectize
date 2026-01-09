import type { MetadataRoute } from 'next'
import { services, getAllBrandPaths, getAllDeviceTypePaths, getAllModelPaths } from '@/lib/data/services'

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
  ]
  
  // Adicionar páginas de serviços
  for (const service of services) {
    routes.push({
      url: `${baseUrl}/servicos/${service.slug}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
    
    // Adicionar páginas de marcas
    const brandPaths = getAllBrandPaths(service.slug)
    for (const { marca } of brandPaths) {
      routes.push({
        url: `${baseUrl}/servicos/${service.slug}/${marca}`,
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.7,
      })
      
      // Adicionar páginas de tipos de equipamento
      const deviceTypePaths = getAllDeviceTypePaths(service.slug, marca)
      for (const { tipo } of deviceTypePaths) {
        routes.push({
          url: `${baseUrl}/servicos/${service.slug}/${marca}/${tipo}`,
          lastModified,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
        
        // Adicionar páginas de modelos
        const modelPaths = getAllModelPaths(service.slug, marca, tipo)
        for (const { modelo } of modelPaths) {
          routes.push({
            url: `${baseUrl}/servicos/${service.slug}/${marca}/${tipo}/${modelo}`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.5,
          })
        }
      }
    }
  }
  
  return routes
}
