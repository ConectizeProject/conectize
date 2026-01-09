import type { Metadata } from 'next'
import { services } from '@/lib/data/services'
import { ServiceCard } from '@/components/seo/ServiceCard'

export const metadata: Metadata = {
  title: 'Serviços de Assistência Técnica em Belo Horizonte | Conectize',
  description: 'Serviços especializados de reparo de celulares e tablets em Belo Horizonte. Troca de tela, bateria, reparo de placa e muito mais. Coleta em domicílio.',
  keywords: 'assistência técnica celular belo horizonte, reparo celular bh, troca de tela, troca de bateria, reparo de placa',
  alternates: {
    canonical: 'https://conectize.com.br/servicos',
  },
}

export default function ServicosPage () {
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-6">
            Qualidade Garantida
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Nossos Serviços de <span className="text-gradient">Assistência Técnica</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Serviços especializados em reparo de celulares, tablets e dispositivos móveis em Belo Horizonte. 
            Utilizamos peças de alta qualidade e técnicas profissionais para garantir a melhor qualidade.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </div>
    </div>
  )
}

