import type { Service, Brand, DeviceType, Model, BreadcrumbItem } from '../types/seo'

export function generatePageTitle (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model): string {
  if (model && deviceType && brand) {
    return `${service.name} do ${model.displayName || model.name} - ${deviceType.displayName} ${brand.displayName} | Conectize`
  }
  if (deviceType && brand) {
    return `${service.name} para ${deviceType.displayName} ${brand.displayName} | Conectize`
  }
  if (brand) {
    return `${service.name} para ${brand.displayName} | Conectize`
  }
  return `${service.name} em Belo Horizonte | Conectize`
}

export function generateMetaDescription (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model): string {
  const location = 'Belo Horizonte'
  
  if (model && deviceType && brand) {
    return `Serviço de ${service.name.toLowerCase()} para ${model.displayName || model.name} (${deviceType.displayName} ${brand.displayName}) em ${location}. Especialistas em reparo. Orçamento rápido e garantia.`
  }
  if (deviceType && brand) {
    return `Serviço de ${service.name.toLowerCase()} para ${deviceType.displayName} ${brand.displayName} em ${location}. Especialistas em reparo. Orçamento rápido e garantia.`
  }
  if (brand) {
    return `Serviço de ${service.name.toLowerCase()} para aparelhos ${brand.displayName} em ${location}. Especialistas em reparo. Orçamento rápido e garantia.`
  }
  return `${service.description} Atendimento em ${location} com coleta em domicílio. Especialistas em reparo de celulares e tablets.`
}

export function generateKeywords (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model): string {
  const baseKeywords = [
    service.name.toLowerCase(),
    ...service.keywords,
    'belo horizonte',
    'bh',
    'assistência técnica',
    'reparo'
  ]
  
  if (brand) {
    baseKeywords.push(brand.name.toLowerCase(), `reparo ${brand.name.toLowerCase()}`)
  }
  
  if (deviceType) {
    baseKeywords.push(deviceType.name.toLowerCase(), `${service.name.toLowerCase()} ${deviceType.name.toLowerCase()}`)
  }
  
  if (model) {
    baseKeywords.push(
      model.name.toLowerCase(),
      `${service.name.toLowerCase()} ${model.name.toLowerCase()}`,
      `${service.name.toLowerCase()} ${deviceType?.name.toLowerCase()} ${model.name.toLowerCase()}`
    )
  }
  
  return baseKeywords.join(', ')
}

export function generateBreadcrumbs (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Serviços', href: '/servicos' },
    { label: service.name, href: `/servicos/${service.slug}` }
  ]
  
  if (brand) {
    breadcrumbs.push({
      label: brand.displayName,
      href: `/servicos/${service.slug}/${brand.slug}`
    })
  }
  
  if (deviceType) {
    breadcrumbs.push({
      label: deviceType.displayName,
      href: `/servicos/${service.slug}/${brand!.slug}/${deviceType.slug}`
    })
  }
  
  if (model) {
    breadcrumbs.push({
      label: model.displayName || model.name,
      href: `/servicos/${service.slug}/${brand!.slug}/${deviceType!.slug}/${model.slug}`
    })
  }
  
  return breadcrumbs
}

export function generateCanonicalUrl (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model): string {
  const baseUrl = 'https://conectize.com.br'
  
  if (model && deviceType && brand) {
    return `${baseUrl}/servicos/${service.slug}/${brand.slug}/${deviceType.slug}/${model.slug}`
  }
  if (deviceType && brand) {
    return `${baseUrl}/servicos/${service.slug}/${brand.slug}/${deviceType.slug}`
  }
  if (brand) {
    return `${baseUrl}/servicos/${service.slug}/${brand.slug}`
  }
  return `${baseUrl}/servicos/${service.slug}`
}

export function generateStructuredData (service: Service, brand?: Brand, deviceType?: DeviceType, model?: Model) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: generatePageTitle(service, brand, deviceType, model),
    description: generateMetaDescription(service, brand, deviceType, model),
    provider: {
      '@type': 'LocalBusiness',
      name: 'Conectize',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'R. Padre Rolim, 620',
        addressLocality: 'Belo Horizonte',
        addressRegion: 'MG',
        postalCode: '30130-094',
        addressCountry: 'BR'
      },
      telephone: '+5531986140889',
      url: 'https://conectize.com.br'
    },
    areaServed: {
      '@type': 'City',
      name: 'Belo Horizonte'
    }
  }
  
  if (model && deviceType && brand) {
    return {
      ...baseData,
      serviceType: `${service.name} - ${deviceType.displayName} ${brand.displayName} ${model.displayName || model.name}`
    }
  }
  
  return baseData
}
