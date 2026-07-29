import Link from 'next/link'
import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { business, buildWhatsAppUrl, getFaqPageJsonLd, getServiceJsonLd } from '@/lib/data/business'
import type { GeoLandingPage } from '@/lib/data/geo-landing-pages'

export function GeoLandingContent({ page }: { page: GeoLandingPage }) {
  const pageUrl = `${business.siteUrl}/${page.slug}`

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getFaqPageJsonLd(page.faq)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getServiceJsonLd({
            name: page.h1,
            description: page.description,
            serviceType: page.serviceType,
            url: pageUrl
          }))
        }}
      />

      <main className="min-h-screen pt-32 pb-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mb-14">
            <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-6">
              {page.eyebrow}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {page.h1}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              {page.intro}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button variant="hero" size="xl" asChild>
                <a href={buildWhatsAppUrl(page.whatsappMessage)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  Pedir orçamento
                </a>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <a href={`tel:${business.phone}`}>
                  <Phone className="w-5 h-5" />
                  Ligar agora
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <article className="space-y-10">
              <section className="rounded-2xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Resumo para quem procura no Google e em IA
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {page.entitySummary}
                </p>
              </section>

              <section className="rounded-2xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Serviços relacionados
                </h2>
                <ul className="grid sm:grid-cols-2 gap-4">
                  {page.serviceLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="block rounded-xl bg-secondary/40 p-4 font-semibold text-foreground hover:text-primary-accessible transition-colors">
                        {link.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {page.sections.map((section) => (
                <section key={section.title} className="rounded-2xl border border-border bg-card p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    {section.title}
                  </h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {section.body}
                  </p>
                </section>
              ))}

              <section className="rounded-2xl border border-border bg-card p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Perguntas frequentes
                </h2>
                <div className="space-y-6">
                  {page.faq.map((item) => (
                    <div key={item.q}>
                      <h3 className="text-lg font-bold text-foreground mb-2">{item.q}</h3>
                      <p className="text-muted-foreground">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            </article>

            <aside className="h-fit lg:sticky lg:top-28 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Dados da assistência
                </h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <MapPin className="w-5 h-5 text-primary-accessible flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground">{business.name}</p>
                      <p>{business.address.streetAddress} - {business.address.neighborhood}</p>
                      <p>{business.address.addressLocality} - {business.address.addressRegion}, {business.address.postalCode}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Horário</p>
                    <p>{business.openingHours[0].label}: {business.openingHours[0].display}</p>
                    <p>{business.openingHours[1].label}: {business.openingHours[1].display}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Contato</p>
                    <p>{business.phoneDisplay}</p>
                    <p>{business.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
                <h2 className="text-xl font-bold text-foreground mb-3">
                  Quer orçamento?
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Envie o modelo do aparelho e uma descrição do defeito para receber orientação pelo WhatsApp.
                </p>
                <a
                  href={buildWhatsAppUrl(page.whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[hsl(142,70%,45%)] px-5 py-3 font-semibold text-white transition-colors hover:bg-[hsl(142,70%,40%)]"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chamar no WhatsApp
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  )
}
