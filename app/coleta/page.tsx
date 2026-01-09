import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Truck, Clock, CheckCircle, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coleta em Domicílio em Belo Horizonte | Conectize',
  description: 'Serviço exclusivo de coleta e entrega em domicílio para conserto de celulares em Belo Horizonte. Buscamos e devolvemos seu aparelho sem custo adicional. Agende agora!',
  keywords: 'coleta em domicilio celular belo horizonte, busca e entrega celular bh, coleta grátis celular, serviço de coleta celular',
  alternates: {
    canonical: 'https://conectize.com.br/coleta',
  },
}

const benefits = [
  'Buscamos seu celular em casa ou no trabalho',
  'Sem custo adicional na região de BH',
  'Diagnóstico rápido e orçamento sem compromisso',
  'Devolução no mesmo local após o conserto',
  'Acompanhamento em tempo real do serviço',
]

export default function ColetaPage () {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-background relative overflow-hidden">
      {/* Background decoration */}
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
            para buscar e devolver seu celular consertado. Comodidade e praticidade 
            para seu dia a dia.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Content */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
              Vantagens do Nosso Serviço
            </h2>

            <ul className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 animate-fade-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-lg">{benefit}</span>
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg" asChild>
              <a
                href="https://wa.me/5531986140889?text=Olá! Gostaria de agendar a coleta do meu celular em domicílio."
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar Coleta Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="bg-card rounded-3xl p-8 shadow-card">
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">Agende a Coleta</h4>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato pelo WhatsApp e escolha o melhor horário
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">Buscamos seu Celular</h4>
                    <p className="text-sm text-muted-foreground">
                      Nossa equipe vai até você em qualquer região de BH
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">Conserto Rápido</h4>
                    <p className="text-sm text-muted-foreground">
                      Diagnóstico, orçamento e reparo com qualidade
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 p-4 bg-accent/10 rounded-2xl border-2 border-accent/30">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-accent-foreground font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">Entrega em Domicílio</h4>
                    <p className="text-sm text-muted-foreground">
                      Devolvemos seu celular funcionando no mesmo local
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -left-4 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Frete Grátis
            </div>
            <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Até 24h
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

