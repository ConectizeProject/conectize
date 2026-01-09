import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServiceBySlug, getBrandBySlug, getModelBySlug } from '@/lib/data/services'
import { generatePageTitle, generateMetaDescription, generateKeywords, generateBreadcrumbs, generateCanonicalUrl, generateStructuredData } from '@/lib/utils/seo'
import { formatModelName } from '@/lib/utils/format-model-name'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import Link from 'next/link'
import { Phone, MessageCircle, MapPin } from 'lucide-react'

interface PageProps {
  params: Promise<{ servico: string; marca: string; tipo: string; modelo: string }>
}

export async function generateMetadata ({ params }: PageProps): Promise<Metadata> {
  const { servico, marca, tipo, modelo } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  const modelData = getModelBySlug(marca, tipo, modelo)
  
  if (!service || !brand || !modelData) {
    return {
      title: 'Página não encontrada | Conectize',
    }
  }
  
  const model = {
    slug: modelData.modelSlug,
    name: modelData.modelSlug,
    displayName: formatModelName(modelData.modelSlug),
    brand: brand.slug,
    deviceType: modelData.deviceType.slug,
    service: service.slug
  }
  
  return {
    title: generatePageTitle(service, brand, modelData.deviceType, model),
    description: generateMetaDescription(service, brand, modelData.deviceType, model),
    keywords: generateKeywords(service, brand, modelData.deviceType, model),
    alternates: {
      canonical: generateCanonicalUrl(service, brand, modelData.deviceType, model),
    },
  }
}

export default async function ModelPage ({ params }: PageProps) {
  const { servico, marca, tipo, modelo } = await params
  const service = getServiceBySlug(servico)
  const brand = getBrandBySlug(marca)
  const modelData = getModelBySlug(marca, tipo, modelo)
  
  if (!service || !brand || !modelData) {
    notFound()
  }
  
  // Verificar se este tipo de dispositivo está excluído para este serviço
  const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
  if (excludedTypes.includes(modelData.deviceType.slug)) {
    notFound()
  }
  
  const model = {
    slug: modelData.modelSlug,
    name: modelData.modelSlug,
    displayName: formatModelName(modelData.modelSlug),
    brand: brand.slug,
    deviceType: modelData.deviceType.slug,
    service: service.slug
  }
  
  const breadcrumbs = generateBreadcrumbs(service, brand, modelData.deviceType, model)
  const structuredData = generateStructuredData(service, brand, modelData.deviceType, model)
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4">
          <Breadcrumbs items={breadcrumbs} />
          
          <div className="max-w-4xl mx-auto">
            <article>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                {service.name} do {model.displayName} - {modelData.deviceType.displayName} {brand.displayName}
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8">
                Serviço especializado de {service.name.toLowerCase()} para {model.displayName} ({modelData.deviceType.displayName} {brand.displayName}) 
                em Belo Horizonte. Realizamos o reparo com peças de alta qualidade, 
                garantindo a melhor compatibilidade, experiência e durabilidade do seu dispositivo.
              </p>

              <div className="prose prose-lg max-w-none mb-12">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Sobre o Serviço de {service.name} para {model.displayName}
                </h2>
                <p className="text-muted-foreground mb-4">
                  O {model.displayName} é um {modelData.deviceType.displayName} {brand.displayName} que requer cuidados específicos 
                  durante o processo de {service.name.toLowerCase()}. Nossa equipe técnica possui experiência 
                  comprovada com este modelo e utiliza técnicas profissionais para garantir um reparo de qualidade.
                </p>
                
                <h3 className="text-xl font-bold text-foreground mb-3">
                  O que está incluído no serviço:
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-6">
                  <li>Diagnóstico completo do problema</li>
                  <li>Substituição com peça de alta qualidade</li>
                  <li>Testes de funcionalidade após o reparo</li>
                  <li>Garantia de 6 meses em todos os serviços realizados</li>
                  <li>Suporte técnico após o reparo</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mb-3">
                  Tempo de Reparo
                </h3>
                <p className="text-muted-foreground mb-6">
                  O tempo médio para {service.name.toLowerCase()} no {model.displayName} varia conforme 
                  a complexidade do caso. Em geral, o serviço é concluído em até 24 horas úteis. 
                  Casos mais complexos podem levar até 48 horas.
                </p>

                <h3 className="text-xl font-bold text-foreground mb-3">
                  Garantia
                </h3>
                <p className="text-muted-foreground mb-6">
                  Oferecemos garantia de 6 meses em todos os serviços de {service.name.toLowerCase()} 
                  realizados no {model.displayName}. A garantia cobre defeitos de fabricação da peça 
                  e problemas relacionados à instalação.
                </p>
              </div>

              <div className="bg-primary/10 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Solicite seu Orçamento
                </h2>
                <p className="text-muted-foreground mb-6">
                  Entre em contato conosco para solicitar um orçamento para 
                  {service.name.toLowerCase()} do seu {model.displayName}. Atendemos em Belo Horizonte 
                  com coleta e entrega em domicílio.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href={`https://wa.me/5531986140889?text=Olá! Gostaria de um orçamento para ${service.name.toLowerCase()} do ${model.displayName}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp
                  </a>
                  <a
                    href="tel:+5531986140889"
                    className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    Ligar Agora
                  </a>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Nossa Localização
                </h2>
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Conectize</p>
                    <p>R. Padre Rolim, 620 - Santa Efigênia</p>
                    <p>Belo Horizonte - MG, 30130-094</p>
                    <p className="mt-2">Segunda a Sexta: 8h às 18h</p>
                    <p>Sábado: 10h às 14h</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  )
}

export async function generateStaticParams () {
  const { getAllModelPaths } = await import('@/lib/data/services')
  const services = await import('@/lib/data/services').then(m => m.services)
  
  const paths: Array<{ servico: string; marca: string; tipo: string; modelo: string }> = []
  
  for (const service of services) {
    for (const brandSlug of service.brands) {
      const brand = await import('@/lib/data/services').then(m => m.brands[brandSlug])
      if (!brand) continue
      
      for (const deviceType of Object.values(brand.deviceTypes)) {
        const modelPaths = getAllModelPaths(service.slug, brandSlug, deviceType.slug)
        paths.push(...modelPaths)
      }
    }
  }
  
  return paths
}


