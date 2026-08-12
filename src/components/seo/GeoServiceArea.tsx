import Link from 'next/link'
import { business } from '@/lib/data/business'

export function GeoServiceArea () {
  return (
    <section className="py-16 bg-secondary/30" aria-labelledby="geo-area-title">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mb-10">
          <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-4">
            Atendemos em BH
          </span>
          <h2 id="geo-area-title" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Coleta e atendimento para Belo Horizonte
          </h2>
          <p className="text-muted-foreground text-lg">
            A loja fica em {business.address.neighborhood}, com atendimento presencial e coleta em domicílio para clientes em Belo Horizonte. Confira alguns bairros atendidos:
          </p>
        </div>

        <ul className="flex flex-wrap gap-3 mb-8" aria-label="Bairros atendidos em Belo Horizonte">
          {business.areaServedNeighborhoods.map((neighborhood) => (
            <li key={neighborhood} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
              {neighborhood}
            </li>
          ))}
        </ul>

        <Link href="/coleta" className="text-primary-accessible font-semibold hover:underline">
          Calcular coleta em domicílio em BH →
        </Link>
      </div>
    </section>
  )
}
