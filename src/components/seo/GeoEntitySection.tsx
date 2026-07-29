import Link from 'next/link'
import { business, buildWhatsAppUrl } from '@/lib/data/business'
import { Button } from '@/components/ui/button'

export function GeoEntitySection () {
  return (
    <section className="py-20 bg-background" aria-labelledby="geo-entity-title">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-4">
              Assistência técnica em BH
            </span>
            <h2 id="geo-entity-title" className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Conectize: assistência técnica de celulares e Apple em Belo Horizonte
            </h2>
            <div className="space-y-4 text-muted-foreground text-lg leading-relaxed">
              <p>
                A Conectize é uma assistência técnica localizada em {business.address.neighborhood}, Belo Horizonte, especializada em conserto de celulares Android e produtos Apple como iPhone, iPad, MacBook e Apple Watch.
              </p>
              <p>
                Atendemos troca de tela, troca de vidro, troca de bateria, reparo de placa, conector, câmera, áudio, danos por líquido e coleta em domicílio dentro de BH, com orçamento por WhatsApp e garantia de 6 meses nos serviços realizados.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button variant="hero" size="lg" asChild>
                <a
                  href={buildWhatsAppUrl('Olá! Gostaria de um orçamento na assistência técnica Conectize.')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pedir orçamento
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/assistencia-tecnica-celular-bh">
                  Ver assistência técnica em BH
                </Link>
              </Button>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <dt className="text-sm font-semibold text-muted-foreground mb-1">Endereço</dt>
              <dd className="font-bold text-foreground">{business.address.streetAddress}, {business.address.neighborhood}</dd>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <dt className="text-sm font-semibold text-muted-foreground mb-1">Telefone/WhatsApp</dt>
              <dd className="font-bold text-foreground">{business.phoneDisplay}</dd>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <dt className="text-sm font-semibold text-muted-foreground mb-1">Horário</dt>
              <dd className="font-bold text-foreground">{business.openingHours[0].shortLabel} {business.openingHours[0].display}</dd>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <dt className="text-sm font-semibold text-muted-foreground mb-1">Garantia</dt>
              <dd className="font-bold text-foreground">6 meses nos serviços</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
