import type { MetadataRoute } from 'next'
import { services, getAllBrandPaths, getAllDeviceTypePaths, getAllModelPaths } from '@/lib/data/services'

export default function sitemap (): MetadataRoute.Sitemap {
  const baseUrl = 'https://conectize.com.br'
  
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/servicos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]
  
  // Adicionar páginas de serviços
  for (const service of services) {
    routes.push({
      url: `${baseUrl}/servicos/${service.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    })
    
    // Adicionar páginas de marcas
    const brandPaths = getAllBrandPaths(service.slug)
    for (const { brand } of brandPaths) {
      routes.push({
        url: `${baseUrl}/servicos/${service.slug}/${brand}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      })
      
      // Adicionar páginas de tipos de equipamento
      const deviceTypePaths = getAllDeviceTypePaths(service.slug, brand)
      for (const { tipo } of deviceTypePaths) {
        routes.push({
          url: `${baseUrl}/servicos/${service.slug}/${brand}/${tipo}`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.6,
        })
        
        // Adicionar páginas de modelos
        const modelPaths = getAllModelPaths(service.slug, brand, tipo)
        for (const { modelo } of modelPaths) {
          routes.push({
            url: `${baseUrl}/servicos/${service.slug}/${brand}/${tipo}/${modelo}`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
          })
        }
      }
    }
  }
  
  return routes
}
