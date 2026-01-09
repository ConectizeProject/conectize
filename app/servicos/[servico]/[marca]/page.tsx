import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServiceBySlug, getBrandBySlug } from '@/lib/data/services'
import { generatePageTitle, generateMetaDescription, generateKeywords, generateBreadcrumbs, generateCanonicalUrl } from '@/lib/utils/seo'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { DeviceTypeCard } from '@/components/seo/DeviceTypeCard'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ servico: string; marca: string }>
}

export async function generateMetadata ({ params }: PageProps): Promise<Metadata> {
  const { servico, marca } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  
  if (!service || !brand) {
    return {
      title: 'Página não encontrada | Conectize',
    }
  }
  
  return {
    title: generatePageTitle(service, brand),
    description: generateMetaDescription(service, brand),
    keywords: generateKeywords(service, brand),
    alternates: {
      canonical: generateCanonicalUrl(service, brand),
    },
  }
}

export default async function BrandPage ({ params }: PageProps) {
  const { servico, marca } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  
  if (!service || !brand) {
    notFound()
  }
  
  const breadcrumbs = generateBreadcrumbs(service, brand)
  // Filtrar tipos de dispositivo excluídos para este serviço
  const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
  const deviceTypes = Object.values(brand.deviceTypes).filter(
    deviceType => !excludedTypes.includes(deviceType.slug)
  )
  
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {service.name} para {brand.displayName} em <span className="text-gradient">Belo Horizonte</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Serviço especializado de {service.name.toLowerCase()} para aparelhos {brand.displayName}. 
            Utilizamos peças de alta qualidade, garantindo a melhor compatibilidade, experiência e durabilidade.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Tipos de Equipamento {brand.displayName} que Atendemos
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deviceTypes.map((deviceType) => (
              <DeviceTypeCard
                key={deviceType.slug}
                deviceType={deviceType}
                serviceSlug={service.slug}
                brandSlug={brand.slug}
              />
            ))}
          </div>
        </div>

        <div className="bg-secondary/30 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Informações sobre {service.name} para {brand.displayName}
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="mb-4">
              Realizamos {service.name.toLowerCase()} em aparelhos {brand.displayName} com técnicas profissionais 
              e peças de alta qualidade. Nossa equipe possui experiência específica com dispositivos {brand.displayName}, 
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
  const { getAllBrandPaths } = await import('@/lib/data/services')
  const services = await import('@/lib/data/services').then(m => m.services)
  
  const paths: Array<{ servico: string; marca: string }> = []
  
  for (const service of services) {
    const brandPaths = getAllBrandPaths(service.slug)
    paths.push(...brandPaths)
  }
  
  return paths
}
