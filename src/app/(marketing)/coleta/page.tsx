import type { Metadata } from 'next'
import { FreteCalculator } from '@/components/FreteCalculator'
import { Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coleta em Domicílio em Belo Horizonte | Conectize',
  description: 'Serviço exclusivo de coleta e entrega em domicílio para conserto de celulares em Belo Horizonte. Calcule o frete pelo seu CEP. Buscamos e devolvemos seu aparelho. Agende agora!',
  keywords: 'coleta em domicilio celular belo horizonte, busca e entrega celular bh, frete coleta celular bh, serviço de coleta celular, calcular frete coleta',
  alternates: {
    canonical: 'https://conectize.com.br/coleta',
  },
}

export default function ColetaPage () {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-6">
            Exclusivo
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Coleta em <span className="text-gradient">Domicílio</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Não precisa sair de casa! Nossa equipe vai até você em toda Belo Horizonte
            para buscar e devolver seu celular consertado. Calcule o valor do frete
            informando seu CEP abaixo.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="relative">
            <div className="bg-card rounded-3xl p-8 shadow-card">
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Agende a Coleta</p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato pelo WhatsApp e escolha o melhor horário
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Buscamos seu Celular</p>
                    <p className="text-sm text-muted-foreground">
                      Nossa equipe vai até você em qualquer região de BH
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Conserto Rápido</p>
                    <p className="text-sm text-muted-foreground">
                      Diagnóstico, orçamento e reparo com qualidade
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-accent/10 rounded-2xl border-2 border-accent/30">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-accent-foreground font-bold">4</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Entrega em Domicílio</p>
                    <p className="text-sm text-muted-foreground">
                      Devolvemos seu celular funcionando no mesmo local
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Até 24h
            </div>
          </div>

          <div className="sticky top-32">
            <FreteCalculator />
          </div>
        </div>
      </div>
    </div>
  )
}

