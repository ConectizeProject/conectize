import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MessageCircle, Phone, MapPin } from 'lucide-react'
import { getBrandBySlug, getModelBySlugAnyType, getServiceBySlug } from '@/lib/data/services'
import { generateKeywords } from '@/lib/utils/seo'
import { formatModelName } from '@/lib/utils/format-model-name'
import { generateProgrammaticContent } from '@/lib/utils/programmatic-content'
import { buildServiceProductSlug, parseServiceProductSlug } from '@/lib/utils/service-product-slug'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { FreteCalculatorLazy } from '@/components/FreteCalculatorLazy'

interface PageProps {
  params: Promise<{ slug: string }>
}

const includedInService = [
  'Diagnóstico completo do problema',
  'Substituição com peça de alta qualidade',
  'Testes de funcionalidade após o reparo',
  'Garantia de 6 meses em todos os serviços realizados',
  'Suporte técnico após o reparo'
]

function ServiceFocusContent(props: { title: string; paragraphs: string[] }) {
  return (
    <section className="bg-card rounded-xl p-8 mb-12 border border-border">
      <h2 className="text-2xl font-bold text-foreground mb-4">
        {props.title}
      </h2>
      <div className="space-y-4 text-muted-foreground">
        {props.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-3">
            O que está incluído no serviço:
          </h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {includedInService.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground mb-3">
            Tempo de reparo
          </h3>
          <p className="text-muted-foreground">
            O tempo médio varia conforme a complexidade do caso. Em geral, o serviço é concluído em até 24 horas úteis. Casos mais complexos podem levar até 48 horas.
          </p>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground mb-3">
            Garantia
          </h3>
          <p className="text-muted-foreground">
            Oferecemos garantia de 6 meses. A garantia cobre defeitos de fabricação da peça e problemas relacionados à instalação.
          </p>
        </div>
      </div>
    </section>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseServiceProductSlug(slug)
  if (!parsed.isValid) {
    return {
      title: 'Página não encontrada | Conectize',
      robots: { index: false, follow: false }
    }
  }

  const service = getServiceBySlug(parsed.serviceSlug)
  const brand = getBrandBySlug(parsed.brandSlug)
  const modelData = getModelBySlugAnyType(parsed.brandSlug, parsed.modelSlug)

  if (!service || !brand) {
    return {
      title: 'Página não encontrada | Conectize',
      robots: { index: false, follow: false }
    }
  }

  // Se o "modelo" for na verdade um tipo de dispositivo (iphone/ipad/smartphone...), vira uma rota fixa indexável
  const deviceType = brand.deviceTypes?.[parsed.modelSlug]
  if (!modelData && deviceType) {
    const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
    if (excludedTypes.includes(deviceType.slug)) {
      return {
        title: 'Página não encontrada | Conectize',
        robots: { index: false, follow: false }
      }
    }

    const content = generateProgrammaticContent({
      service,
      brand,
      deviceType
    })

    return {
      title: content.title,
      description: content.description,
      keywords: generateKeywords(service, brand, deviceType),
      alternates: { canonical: `/servicos/${slug}` }
    }
  }

  if (!modelData) {
    return {
      title: 'Página não encontrada | Conectize',
      robots: { index: false, follow: false }
    }
  }

  const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
  if (excludedTypes.includes(modelData.deviceType.slug)) {
    return {
      title: 'Página não encontrada | Conectize',
      robots: { index: false, follow: false }
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

  const content = generateProgrammaticContent({
    service,
    brand,
    deviceType: modelData.deviceType,
    model
  })

  return {
    title: content.title,
    description: content.description,
    keywords: generateKeywords(service, brand, modelData.deviceType, model),
    alternates: {
      canonical: `/servicos/${slug}`
    }
  }
}

export default async function ServiceProductPage({ params }: PageProps) {
  const { slug } = await params
  const parsed = parseServiceProductSlug(slug)
  if (!parsed.isValid) notFound()

  const service = getServiceBySlug(parsed.serviceSlug)
  const brand = getBrandBySlug(parsed.brandSlug)
  const modelData = getModelBySlugAnyType(parsed.brandSlug, parsed.modelSlug)

  if (!service || !brand) notFound()

  // Rota fixa: /servicos/<servico>-<marca>-<dispositivo>
  const deviceType = !modelData ? brand.deviceTypes?.[parsed.modelSlug] : null
  if (!modelData && deviceType) {
    const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
    if (excludedTypes.includes(deviceType.slug)) notFound()

    const content = generateProgrammaticContent({
      service,
      brand,
      deviceType
    })

    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Serviços', href: '/servicos' },
      { label: brand.displayName, href: `/servicos?marca=${brand.slug}` },
      { label: service.name, href: `/servicos?marca=${brand.slug}&servico=${service.slug}` },
      { label: deviceType.displayName, href: `/servicos/${slug}` }
    ]

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: content.h1,
      description: content.sections.intro,
      areaServed: { '@type': 'City', name: 'Belo Horizonte' },
      provider: { '@type': 'LocalBusiness', name: 'Conectize' }
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        <div className="min-h-screen pt-32 pb-20">
          <div className="container mx-auto px-4">
            <Breadcrumbs items={breadcrumbs} />

            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              <article className="min-w-0">
                <header className="mb-8">
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                    {content.h1}
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    {content.sections.intro}
                  </p>
                </header>

                <ServiceFocusContent
                  title={`Sobre o serviço de ${service.name} para ${deviceType.displayName}`}
                  paragraphs={[
                    `Serviço especializado de ${service.name.toLowerCase()} para ${deviceType.displayName} (${brand.displayName}) em Belo Horizonte. Realizamos o reparo com peças de alta qualidade, garantindo compatibilidade, experiência e durabilidade do seu dispositivo.`,
                    `${deviceType.displayName} ${brand.displayName} exige cuidados específicos durante o processo de ${service.name.toLowerCase()}. Nossa equipe técnica tem experiência comprovada e utiliza técnicas profissionais para entregar um reparo estável e seguro.`
                  ]}
                />

                <section className="bg-card rounded-xl p-8 mb-12 border border-border">
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    Sinais e problemas comuns nesta rota
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    {content.sections.problems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="bg-card rounded-xl p-8 mb-12 border border-border">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Modelos {deviceType.displayName} que atendemos
                  </h2>
                  <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {deviceType.models.map((modelSlug) => (
                      <li key={modelSlug}>
                        <Link
                          href={`/servicos/${buildServiceProductSlug({ serviceSlug: service.slug, brandSlug: brand.slug, modelSlug })}`}
                          className="block bg-secondary/30 rounded-xl p-6 hover:bg-secondary/40 transition-colors border border-border"
                        >
                          <h3 className="text-lg font-bold text-foreground mb-2">
                            {formatModelName(modelSlug)}
                          </h3>
                          <span className="text-primary text-sm font-medium hover:underline">
                            Ver orçamento →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="bg-card rounded-xl p-8 border border-border">
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    FAQ — {service.name}
                  </h2>
                  <div className="space-y-6">
                    {content.sections.faq.map((item) => (
                      <div key={item.q}>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                        <p className="text-muted-foreground">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </article>

              <aside className="h-fit lg:sticky lg:top-28 space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    Calcule a coleta por CEP
                  </h2>
                  <FreteCalculatorLazy />
                </div>

                <Card className="bg-primary/10">
                  <CardHeader>
                    <CardTitle>Solicite um orçamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Entre em contato para solicitar um orçamento para {service.name.toLowerCase()} do seu {deviceType.displayName}.
                    </p>
                    <div className="flex flex-col gap-3">
                      <a
                        href={`https://wa.me/5531986140889?text=Olá! Gostaria de um orçamento para ${service.name.toLowerCase()} do meu ${deviceType.displayName}.`}
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
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!modelData) notFound()

  const excludedTypes = service.excludedDeviceTypes?.[brand.slug] || []
  if (excludedTypes.includes(modelData.deviceType.slug)) notFound()

  const model = {
    slug: modelData.modelSlug,
    name: modelData.modelSlug,
    displayName: formatModelName(modelData.modelSlug),
    brand: brand.slug,
    deviceType: modelData.deviceType.slug,
    service: service.slug
  }

  const content = generateProgrammaticContent({
    service,
    brand,
    deviceType: modelData.deviceType,
    model
  })

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Serviços', href: '/servicos' },
    { label: brand.displayName, href: `/servicos?marca=${brand.slug}` },
    { label: service.name, href: `/servicos?marca=${brand.slug}&servico=${service.slug}` },
    { label: model.displayName, href: `/servicos/${slug}` }
  ]

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: content.h1,
    description: content.sections.intro,
    areaServed: { '@type': 'City', name: 'Belo Horizonte' },
    provider: { '@type': 'LocalBusiness', name: 'Conectize' }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4">
          <Breadcrumbs items={breadcrumbs} />

          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <article className="min-w-0">
              <header className="mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                  {content.h1}
                </h1>

                <p className="text-lg text-muted-foreground">
                  {content.sections.intro}
                </p>
              </header>

              <ServiceFocusContent
                title={`Sobre o serviço de ${service.name} para ${model.displayName}`}
                paragraphs={[
                  `Serviço especializado de ${service.name.toLowerCase()} para ${model.displayName} (${modelData.deviceType.displayName} ${brand.displayName}) em Belo Horizonte. Realizamos o reparo com peças de alta qualidade, garantindo compatibilidade, experiência e durabilidade do seu dispositivo.`,
                  `O ${model.displayName} é um ${modelData.deviceType.displayName} ${brand.displayName} que requer cuidados específicos durante o processo de ${service.name.toLowerCase()}. Nossa equipe técnica possui experiência comprovada com este modelo e utiliza técnicas profissionais para garantir um reparo de qualidade.`
                ]}
              />

              <section className="bg-card rounded-xl p-8 mb-12 border border-border">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Sinais e problemas comuns no {model.displayName}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  {content.sections.problems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="bg-card rounded-xl p-8 mb-12 border border-border">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  FAQ — {service.name} ({brand.displayName})
                </h2>
                <div className="space-y-6">
                  {content.sections.faq.map((item) => (
                    <div key={item.q}>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                      <p className="text-muted-foreground">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-secondary/30 rounded-xl p-8">
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
              </section>

              <div className="mt-10">
                <Link
                  href={brand.slug ? `/servicos?marca=${brand.slug}&servico=${service.slug}` : '/servicos'}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Ver outras opções
                </Link>
              </div>
            </article>

            <aside className="h-fit lg:sticky lg:top-28 space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Calcule a coleta por CEP
                </h2>
                <FreteCalculatorLazy />
              </div>

              <Card className="bg-primary/10">
                <CardHeader>
                  <CardTitle>Solicite um orçamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Entre em contato para solicitar um orçamento para {service.name.toLowerCase()} do seu {model.displayName}. Atendemos em Belo Horizonte com coleta e entrega em domicílio.
                  </p>
                  <div className="flex flex-col gap-3">
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
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}

export async function generateStaticParams() {
  const { services, brands } = await import('@/lib/data/services')
  const { buildServiceProductSlug } = await import('@/lib/utils/service-product-slug')

  const paths: Array<{ slug: string }> = []

  for (const service of services) {
    for (const brandSlug of service.brands) {
      const brand = brands[brandSlug]
      if (!brand) continue

      const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []
      const seenModels = new Set<string>()

      for (const deviceType of Object.values(brand.deviceTypes)) {
        if (excludedTypes.includes(deviceType.slug)) continue
        for (const modelSlug of deviceType.models) seenModels.add(modelSlug)
      }

      for (const modelSlug of seenModels) {
        paths.push({
          slug: buildServiceProductSlug({ serviceSlug: service.slug, brandSlug, modelSlug })
        })
      }
    }
  }

  return paths
}

