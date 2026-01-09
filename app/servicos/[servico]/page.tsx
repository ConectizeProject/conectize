import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServiceBySlug, getBrandBySlug } from '@/lib/data/services'
import { generatePageTitle, generateMetaDescription, generateKeywords, generateBreadcrumbs, generateCanonicalUrl } from '@/lib/utils/seo'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { BrandCard } from '@/components/seo/BrandCard'

interface PageProps {
  params: Promise<{ servico: string }>
}

export async function generateMetadata ({ params }: PageProps): Promise<Metadata> {
  const { servico } = await params
  const service = getServiceBySlug(servico)
  
  if (!service) {
    return {
      title: 'Serviço não encontrado | Conectize',
    }
  }
  
  return {
    title: generatePageTitle(service),
    description: generateMetaDescription(service),
    keywords: generateKeywords(service),
    alternates: {
      canonical: generateCanonicalUrl(service),
    },
  }
}

export default async function ServicePage ({ params }: PageProps) {
  const { servico } = await params
  const service = getServiceBySlug(servico)
  
  if (!service) {
    notFound()
  }
  
  const breadcrumbs = generateBreadcrumbs(service)
  const brandObjects = service.brands
    .map(slug => getBrandBySlug(slug))
    .filter((brand): brand is NonNullable<typeof brand> => brand !== undefined)
  
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {service.name} em <span className="text-gradient">Belo Horizonte</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {service.description}
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Marcas que Atendemos
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brandObjects.map((brand) => (
              <BrandCard
                key={brand.slug}
                brand={brand}
                serviceSlug={service.slug}
              />
            ))}
          </div>
        </div>

        <div className="bg-secondary/30 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Por que escolher a Conectize?
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>Peças de alta qualidade</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>Equipe técnica especializada e certificada</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>Garantia de 6 meses em todos os serviços realizados</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>Coleta e entrega em domicílio na região de BH</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>Diagnóstico e orçamento rápido</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export async function generateStaticParams () {
  const { getAllServicePaths } = await import('@/lib/data/services')
  return getAllServicePaths()
}

