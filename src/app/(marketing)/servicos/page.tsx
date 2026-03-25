import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { brands, services } from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ServicesFiltersLazy } from '@/components/services/ServicesFiltersLazy'
import { ClearServicosFiltersButton } from '@/components/services/ClearServicosFiltersButton'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'

type SearchParams = Promise<{ marca?: string; servico?: string; dispositivo?: string; modelo?: string; page?: string }>

const pageSize = 24

const quickFilters = [
  {
    label: 'Troca de vidro Apple Watch',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-vidro-da-tela', brandSlug: 'apple', modelSlug: 'watch' })}`
  },
  {
    label: 'Troca de display do iPhone',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-tela', brandSlug: 'apple', modelSlug: 'iphone' })}`
  },
  {
    label: 'Troca de conector de carga Samsung',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-conector', brandSlug: 'samsung', modelSlug: 'smartphone' })}`
  },
  {
    label: 'Troca de bateria do iPhone',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-bateria', brandSlug: 'apple', modelSlug: 'iphone' })}`
  },
  {
    label: 'Troca de bateria Samsung',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-bateria', brandSlug: 'samsung', modelSlug: 'smartphone' })}`
  },
  {
    label: 'Troca de vidro do iPhone',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-vidro-da-tela', brandSlug: 'apple', modelSlug: 'iphone' })}`
  },
  {
    label: 'Troca de display Samsung Galaxy',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-tela', brandSlug: 'samsung', modelSlug: 'smartphone' })}`
  },
  {
    label: 'Reparo de câmera do iPhone',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-camera', brandSlug: 'apple', modelSlug: 'iphone' })}`
  },
  {
    label: 'Reparo por água no iPhone',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'reparo-de-agua', brandSlug: 'apple', modelSlug: 'iphone' })}`
  },
  {
    label: 'Correções de software MacBook',
    href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'correcoes-de-software', brandSlug: 'apple', modelSlug: 'macbook' })}`
  }
]

function parsePage(value?: string) {
  const parsed = Number.parseInt(value || '1', 10)
  if (Number.isNaN(parsed) || parsed < 1) return 1
  return parsed
}

function buildServicosHref(input: { marca?: string; servico?: string; dispositivo?: string; modelo?: string; page?: number }) {
  const params = new URLSearchParams()
  if (input.marca) params.set('marca', input.marca)
  if (input.servico) params.set('servico', input.servico)
  if (input.dispositivo) params.set('dispositivo', input.dispositivo)
  if (input.modelo) params.set('modelo', input.modelo)
  if (input.page && input.page > 1) params.set('page', String(input.page))
  const query = params.toString()
  return query ? `/servicos?${query}` : '/servicos'
}

function getBrandBlocks() {
  const brandList = Object.values(brands)
    .slice()

  return brandList.map((brand) => {
    const availableServices = services
      .filter(service => service.brands.includes(brand.slug))
      .slice()

    return {
      brand,
      services: availableServices
    }
  })
}

function uniqueModelsForBrandAndService(brandSlug: string, serviceSlug: string, deviceTypeSlug?: string) {
  const brand = brands[brandSlug]
  const service = services.find(s => s.slug === serviceSlug)
  if (!brand || !service) return []

  const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []
  const seen = new Set<string>()
  const models: string[] = []

  for (const deviceType of Object.values(brand.deviceTypes)) {
    if (excludedTypes.includes(deviceType.slug)) continue
    if (deviceTypeSlug && deviceType.slug !== deviceTypeSlug) continue
    for (const modelSlug of deviceType.models) {
      if (seen.has(modelSlug)) continue
      seen.add(modelSlug)
      models.push(modelSlug)
    }
  }

  return models
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { marca, servico, dispositivo, modelo } = await searchParams
  const selectedBrand = marca && brands[marca] ? brands[marca] : null
  const selectedService = servico ? services.find(s => s.slug === servico) : null

  const title = (() => {
    if (selectedBrand && selectedService && modelo) {
      return `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelo)} em Belo Horizonte | Conectize`
    }

    if (selectedBrand && selectedService && dispositivo && selectedBrand.deviceTypes?.[dispositivo]) {
      return `${selectedService.name} ${selectedBrand.deviceTypes[dispositivo].displayName} ${selectedBrand.displayName} em Belo Horizonte | Conectize`
    }

    if (selectedBrand && selectedService) {
      return `${selectedService.name} ${selectedBrand.displayName} em Belo Horizonte | Conectize`
    }

    if (selectedBrand) return `Serviços para ${selectedBrand.displayName} em Belo Horizonte | Conectize`

    return 'Serviços de Assistência Técnica em Belo Horizonte | Conectize'
  })()

  return {
    title,
    description: 'Serviços especializados de reparo em Belo Horizonte. Filtre por marca, serviço, dispositivo e modelo para solicitar orçamento.',
    keywords: 'assistência técnica celular belo horizonte, reparo celular bh, troca de tela, troca de bateria, reparo de placa',
    alternates: {
      canonical: 'https://conectize.com.br/servicos',
    },
  }
}

export default async function ServicosPage({ searchParams }: { searchParams: SearchParams }) {
  const { marca, servico, dispositivo, modelo, page } = await searchParams
  const currentPage = parsePage(page)

  const selectedBrand = marca && brands[marca] ? brands[marca] : null
  const selectedService = servico ? services.find(s => s.slug === servico) : null
  const isFiltering = Boolean(marca || servico || dispositivo || modelo)
  const selectedDeviceType = selectedBrand && dispositivo ? selectedBrand.deviceTypes?.[dispositivo] : null

  const h1 = (() => {
    if (selectedBrand && selectedService && modelo) {
      return `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelo)}`
    }

    if (selectedBrand && selectedService && selectedDeviceType) {
      return `${selectedService.name} ${selectedDeviceType.displayName} ${selectedBrand.displayName}`
    }

    if (selectedBrand && selectedService) {
      return `${selectedService.name} ${selectedBrand.displayName}`
    }

    if (selectedBrand) return `Serviços para ${selectedBrand.displayName}`

    return null
  })()

  const results = (() => {
    // Caso 1: marca + serviço selecionados -> listar modelos
    if (selectedBrand && selectedService) {
      const deviceType = dispositivo && selectedBrand.deviceTypes?.[dispositivo] ? dispositivo : undefined
      const modelSlugs = uniqueModelsForBrandAndService(selectedBrand.slug, selectedService.slug, deviceType)
      const filtered = modelo ? modelSlugs.filter(m => m === modelo) : modelSlugs
      const total = filtered.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(currentPage, totalPages)
      const start = (safePage - 1) * pageSize
      const end = start + pageSize

      return {
        total,
        totalPages,
        currentPage: safePage,
        items: filtered.slice(start, end).map(modelSlug => ({
          href: `/servicos/${buildServiceProductSlug({ serviceSlug: selectedService.slug, brandSlug: selectedBrand.slug, modelSlug })}`,
          title: `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelSlug)}`,
          subtitle: 'Clique para ver detalhes e solicitar orçamento'
        }))
      }
    }

    // Caso 2 (default): listar todas as páginas de produto (serviço + marca + modelo)
    const entries: Array<{ href: string; title: string; subtitle: string }> = []

    for (const service of services) {
      if (servico && service.slug !== servico) continue

      for (const brandSlug of service.brands) {
        if (marca && brandSlug !== marca) continue

        const brand = brands[brandSlug]
        if (!brand) continue

        const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []

        for (const deviceType of Object.values(brand.deviceTypes)) {
          if (excludedTypes.includes(deviceType.slug)) continue
          if (dispositivo && deviceType.slug !== dispositivo) continue

          for (const modelSlug of deviceType.models) {
            if (modelo && modelSlug !== modelo) continue
            entries.push({
              href: `/servicos/${buildServiceProductSlug({ serviceSlug: service.slug, brandSlug, modelSlug })}`,
              title: `${service.name} ${brand.displayName} ${formatModelName(modelSlug)}`,
              subtitle: `${deviceType.displayName} • Clique para ver detalhes e solicitar orçamento`
            })
          }
        }
      }
    }

    const total = entries.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * pageSize
    const end = start + pageSize

    return {
      total,
      totalPages,
      currentPage: safePage,
      items: entries.slice(start, end)
    }
  })()

  const breadcrumbs = (() => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Serviços', href: '/servicos' },
    ]

    if (selectedBrand) items.push({ label: selectedBrand.displayName, href: buildServicosHref({ marca: selectedBrand.slug }) })
    if (selectedService) items.push({ label: selectedService.name, href: buildServicosHref({ marca, servico }) })

    if (selectedBrand && dispositivo && selectedBrand.deviceTypes?.[dispositivo]) {
      items.push({ label: selectedBrand.deviceTypes[dispositivo].displayName, href: buildServicosHref({ marca, servico, dispositivo }) })
    }

    if (modelo) items.push({ label: formatModelName(modelo), href: buildServicosHref({ marca, servico, dispositivo, modelo }) })

    return items
  })()

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="lg:sticky lg:top-28 h-fit">
            <ServicesFiltersLazy />

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Filtros rápidos</CardTitle>
                <CardDescription>
                  Atalhos comuns para começar.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {quickFilters.map((item) => (
                  <Button key={item.href} asChild variant="secondary" size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </aside>

          <main>
            <Breadcrumbs items={breadcrumbs} />
            <header>
              <h1 className="inline-block text-4xl md:text-5xl font-bold text-foreground mb-4 mt-4">
                {isFiltering && h1 ? (
                  h1
                ) : (
                  <>
                    Nossos Serviços de <span className="text-gradient">Assistência Técnica</span>
                  </>
                )}
              </h1>
            </header>

            {!isFiltering ? (
              <section aria-label="Serviços por marca" className="mt-10 space-y-10">
                {getBrandBlocks().map(({ brand, services: brandServices }) => (
                  <Card key={brand.slug} className="border border-border">
                    <CardHeader className="pb-4">
                      <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div>
                          <CardTitle className="text-2xl">{brand.displayName}</CardTitle>
                          <CardDescription>
                            Serviços mais procurados e opções disponíveis para {brand.displayName}.
                          </CardDescription>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href={buildServicosHref({ marca: brand.slug })}>
                            Ver mais
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {brandServices.slice(0, 6).map((service) => (
                          <li key={`${brand.slug}-${service.slug}`}>
                            <Link
                              href={buildServicosHref({ marca: brand.slug, servico: service.slug })}
                              className="block bg-secondary/30 rounded-xl p-5 hover:bg-secondary/40 transition-colors border border-border"
                            >
                              <h3 className="font-semibold text-foreground mb-1">
                                {service.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {service.shortDescription}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : (
              <section aria-label="Resultados" className="space-y-4 mt-10">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Resultados
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedBrand && selectedService
                        ? (
                          <>
                            Mostrando modelos para <b>{selectedService.name}</b> em{' '}
                            <b>{selectedBrand.displayName}</b>
                          </>
                        )
                        : 'Mostrando todas as opções disponíveis. Use os filtros para refinar.'}
                    </p>
                  </div>

                  {(marca || servico || dispositivo || modelo) && (
                    <ClearServicosFiltersButton />
                  )}
                </div>

                {results.items.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Nenhum resultado encontrado</CardTitle>
                      <CardDescription>
                        Ajuste os filtros ou limpe para ver todas as páginas disponíveis.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        {results.total} resultados • Página {results.currentPage} de {results.totalPages}
                      </p>
                      {results.totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          {results.currentPage <= 1
                            ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                aria-disabled="true"
                                className="text-muted-foreground border-border/50 bg-muted/20"
                              >
                                <span className="sr-only">Anterior</span>
                                <ArrowLeft className="w-4 h-4" />
                              </Button>
                              )
                            : (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={buildServicosHref({
                                    marca,
                                    servico,
                                    dispositivo,
                                    modelo: selectedBrand && selectedService ? modelo : undefined,
                                    page: Math.max(1, results.currentPage - 1)
                                  })}
                                  aria-label="Página anterior"
                                >
                                  <span className="sr-only">Anterior</span>
                                  <ArrowLeft className="w-4 h-4" />
                                </Link>
                              </Button>
                              )}

                          {results.currentPage >= results.totalPages
                            ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                aria-disabled="true"
                                className="text-muted-foreground border-border/50 bg-muted/20"
                              >
                                <span className="sr-only">Próxima</span>
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              )
                            : (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={buildServicosHref({
                                    marca,
                                    servico,
                                    dispositivo,
                                    modelo: selectedBrand && selectedService ? modelo : undefined,
                                    page: Math.min(results.totalPages, results.currentPage + 1)
                                  })}
                                  aria-label="Próxima página"
                                >
                                  <span className="sr-only">Próxima</span>
                                  <ArrowRight className="w-4 h-4" />
                                </Link>
                              </Button>
                              )}
                        </div>
                      )}
                    </div>

                    <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {results.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50"
                          >
                            <h3 className="text-lg font-bold text-foreground mb-2">
                              {item.title}
                            </h3>
                            <p className="text-muted-foreground text-sm mb-4">
                              {item.subtitle}
                            </p>
                            <span className="text-primary text-sm font-medium hover:underline">
                              Ver detalhes →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {results.totalPages > 1 && (
                      <div className="flex justify-center pt-2">
                        <div className="flex items-center gap-2">
                          {results.currentPage <= 1
                            ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                aria-disabled="true"
                                className="text-muted-foreground border-border/50 bg-muted/20"
                              >
                                <span className="sr-only">Anterior</span>
                                <ArrowLeft className="w-4 h-4" />
                              </Button>
                              )
                            : (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={buildServicosHref({
                                    marca,
                                    servico,
                                    dispositivo,
                                    modelo: selectedBrand && selectedService ? modelo : undefined,
                                    page: Math.max(1, results.currentPage - 1)
                                  })}
                                  aria-label="Página anterior"
                                >
                                  <span className="sr-only">Anterior</span>
                                  <ArrowLeft className="w-4 h-4" />
                                </Link>
                              </Button>
                              )}
                          <span className="text-sm text-muted-foreground px-2">
                            Página {results.currentPage} / {results.totalPages}
                          </span>
                          {results.currentPage >= results.totalPages
                            ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                aria-disabled="true"
                                className="text-muted-foreground border-border/50 bg-muted/20"
                              >
                                <span className="sr-only">Próxima</span>
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              )
                            : (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={buildServicosHref({
                                    marca,
                                    servico,
                                    dispositivo,
                                    modelo: selectedBrand && selectedService ? modelo : undefined,
                                    page: Math.min(results.totalPages, results.currentPage + 1)
                                  })}
                                  aria-label="Próxima página"
                                >
                                  <span className="sr-only">Próxima</span>
                                  <ArrowRight className="w-4 h-4" />
                                </Link>
                              </Button>
                              )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

