import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServiceBySlug, getBrandBySlug, getDeviceTypeBySlug } from '@/lib/data/services'
import { generatePageTitle, generateMetaDescription, generateKeywords, generateBreadcrumbs, generateCanonicalUrl } from '@/lib/utils/seo'
import { formatModelName } from '@/lib/utils/format-model-name'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { ModelCard } from '@/components/seo/ModelCard'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ servico: string; marca: string; tipo: string }>
}

export async function generateMetadata ({ params }: PageProps): Promise<Metadata> {
  const { servico, marca, tipo } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  const deviceType = getDeviceTypeBySlug(marca, tipo)
  
  if (!service || !brand || !deviceType) {
    return {
      title: 'Página não encontrada | Conectize',
    }
  }
  
  return {
    title: generatePageTitle(service, brand, deviceType),
    description: generateMetaDescription(service, brand, deviceType),
    keywords: generateKeywords(service, brand, deviceType),
    alternates: {
      canonical: generateCanonicalUrl(service, brand, deviceType),
    },
  }
}

export default async function DeviceTypePage ({ params }: PageProps) {
  const { servico, marca, tipo } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  const deviceType = getDeviceTypeBySlug(marca, tipo)
  
  if (!service || !brand || !deviceType) {
    notFound()
  }
  
  // Verificar se este tipo de dispositivo está excluído para este serviço
  const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
  if (excludedTypes.includes(deviceType.slug)) {
    notFound()
  }
  
  const breadcrumbs = generateBreadcrumbs(service, brand, deviceType)
  
  // Criar objetos de modelo a partir dos slugs
  const models = deviceType.models.map(slug => ({
    slug,
    name: slug,
    displayName: formatModelName(slug),
    brand: brand.slug,
    deviceType: deviceType.slug,
    service: service.slug
  }))
  
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {service.name} para {deviceType.displayName} {brand.displayName} em <span className="text-gradient">Belo Horizonte</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Serviço especializado de {service.name.toLowerCase()} para {deviceType.displayName} {brand.displayName}. 
            Utilizamos peças de alta qualidade, garantindo a melhor compatibilidade, experiência e durabilidade.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Modelos {deviceType.displayName} {brand.displayName} que Atendemos
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <ModelCard
                key={model.slug}
                model={model}
                serviceSlug={service.slug}
                brandSlug={brand.slug}
                deviceTypeSlug={deviceType.slug}
              />
            ))}
          </div>
        </div>

        <div className="bg-secondary/30 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Informações sobre {service.name} para {deviceType.displayName} {brand.displayName}
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="mb-4">
              Realizamos {service.name.toLowerCase()} em {deviceType.displayName} {brand.displayName} com técnicas profissionais 
              e peças de alta qualidade. Nossa equipe possui experiência específica com dispositivos {deviceType.displayName} {brand.displayName}, 
              garantindo um serviço preciso e confiável.
            </p>
            <p>
              Oferecemos garantia de 6 meses em todos os serviços realizados e suporte técnico após o reparo. 
              Entre em contato para solicitar um orçamento.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/#contato"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Solicitar Orçamento
          </Link>
        </div>
      </div>
    </div>
  )
}

export async function generateStaticParams () {
  const { getAllDeviceTypePaths } = await import('@/lib/data/services')
  const services = await import('@/lib/data/services').then(m => m.services)
  
  const paths: Array<{ servico: string; marca: string; tipo: string }> = []
  
  for (const service of services) {
    for (const brandSlug of service.brands) {
      const deviceTypePaths = getAllDeviceTypePaths(service.slug, brandSlug)
      paths.push(...deviceTypePaths)
    }
  }
  
  return paths
}


