import type { Metadata } from 'next'
import { Building2, Wrench, Smartphone, TrendingUp, Users, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Atendimento para Lojistas - Condições Especiais | Conectize',
  description: 'Condições diferenciadas para lojistas: manutenção de aparelhos, venda de celulares seminovos e suporte técnico especializado. Parcerias e descontos para revendedores.',
  keywords: 'atendimento lojistas belo horizonte, condições especiais lojistas, celulares seminovos, manutenção para lojistas, atacado celular',
  alternates: {
    canonical: 'https://conectize.com.br/lojistas',
  },
}

const beneficios = [
  {
    icon: TrendingUp,
    title: 'Condições Diferenciadas',
    description: 'Preços especiais e condições de pagamento flexíveis para lojistas e revendedores.',
  },
  {
    icon: Wrench,
    title: 'Manutenção Especializada',
    description: 'Serviços de reparo e manutenção com prioridade e prazos reduzidos para seu negócio.',
  },
  {
    icon: Smartphone,
    title: 'Aparelhos Seminovos',
    description: 'Venda de celulares seminovos testados e com garantia, ideais para revenda.',
  },
  {
    icon: Users,
    title: 'Atendimento Dedicado',
    description: 'Equipe especializada para atender as necessidades específicas do seu negócio.',
  },
]

export default function LojistasPage () {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-6">
            Para Lojistas
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Condições <span className="text-gradient">Diferenciadas</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Oferecemos condições especiais para lojistas e revendedores. Manutenção profissional, 
            venda de aparelhos seminovos e suporte técnico especializado para o seu negócio.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {beneficios.map((beneficio, index) => (
            <div
              key={beneficio.title}
              className="bg-card rounded-2xl p-8 shadow-card hover:shadow-lg transition-shadow animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-16 h-16 gradient-primary rounded-xl flex items-center justify-center mb-6">
                <beneficio.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                {beneficio.title}
              </h3>
              <p className="text-muted-foreground text-lg">
                {beneficio.description}
              </p>
            </div>
          ))}
        </div>

        {/* Seções detalhadas */}
        <div className="max-w-4xl mx-auto space-y-8 mb-16">
          <div className="bg-card rounded-2xl p-8 shadow-card">
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Condições Especiais para Lojistas
                </h2>
                <p className="text-muted-foreground text-lg mb-4">
                  Entendemos as necessidades do seu negócio e oferecemos condições diferenciadas 
                  que ajudam a maximizar seus resultados. Trabalhamos com:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Preços especiais para compras em volume</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Condições de pagamento flexíveis</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Descontos progressivos conforme volume</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Suporte técnico prioritário</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-card">
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Wrench className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Manutenção para Lojistas
                </h2>
                <p className="text-muted-foreground text-lg mb-4">
                  Oferecemos serviços de manutenção e reparo com foco nas necessidades dos lojistas:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Reparo rápido com prazos reduzidos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Atendimento prioritário para lojistas parceiros</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Garantia estendida em todos os serviços</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Relatórios técnicos detalhados</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-card">
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Venda de Aparelhos Seminovos
                </h2>
                <p className="text-muted-foreground text-lg mb-4">
                  Oferecemos celulares seminovos testados e com garantia, ideais para revenda:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Aparelhos testados e certificados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Garantia de 3 meses em todos os aparelhos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Diversas marcas e modelos disponíveis</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent font-bold">•</span>
                    <span>Preços competitivos para revenda</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mx-auto bg-card rounded-2xl p-8 shadow-card text-center">
          <Award className="w-16 h-16 text-primary mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Seja Nosso Parceiro
          </h2>
          <p className="text-muted-foreground text-lg mb-6">
            Entre em contato conosco para conhecer nossas condições especiais para lojistas 
            e descubra como podemos ajudar a impulsionar seu negócio.
          </p>
          <Button variant="hero" size="lg" asChild>
            <a
              href="https://wa.me/5531986140889?text=Olá! Sou lojista e gostaria de conhecer as condições especiais para parceiros."
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com Nossa Equipe
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

