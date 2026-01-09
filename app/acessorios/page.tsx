import type { Metadata } from 'next'
import { Smartphone, Battery, Shield, Headphones, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Acessórios para Celular em Belo Horizonte | Conectize',
  description: 'Acessórios de qualidade para seu celular: capinhas, carregadores, películas protetoras e fones de ouvido. Encontre tudo que você precisa na Conectize em Belo Horizonte.',
  keywords: 'acessorios celular belo horizonte, capinha celular bh, carregador celular, pelicula celular, fone de ouvido celular',
  alternates: {
    canonical: 'https://conectize.com.br/acessorios',
  },
}

const acessorios = [
  {
    icon: Shield,
    title: 'Capinhas',
    description: 'Proteção completa para seu celular com capinhas de alta qualidade. Modelos para todas as marcas e modelos.',
  },
  {
    icon: Battery,
    title: 'Carregadores',
    description: 'Carregadores originais e compatíveis para todas as marcas. Cabos USB-C, Lightning e micro USB.',
  },
  {
    icon: Smartphone,
    title: 'Películas',
    description: 'Películas protetoras de vidro temperado para manter a tela do seu celular sempre protegida.',
  },
  {
    icon: Headphones,
    title: 'Fones de Ouvido',
    description: 'Fones de ouvido com fio e sem fio (bluetooth) de diversas marcas e modelos para todos os gostos.',
  },
]

export default function AcessoriosPage () {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-6">
            Acessórios
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Acessórios para <span className="text-gradient">Seu Celular</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Encontre os melhores acessórios para proteger e complementar seu dispositivo móvel. 
            Temos capinhas, carregadores, películas e muito mais!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {acessorios.map((acessorio, index) => (
            <div
              key={acessorio.title}
              className="bg-card rounded-2xl p-8 shadow-card hover:shadow-lg transition-shadow animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-16 h-16 gradient-primary rounded-xl flex items-center justify-center mb-6">
                <acessorio.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                {acessorio.title}
              </h3>
              <p className="text-muted-foreground text-lg">
                {acessorio.description}
              </p>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto bg-card rounded-2xl p-8 shadow-card text-center">
          <ShoppingBag className="w-16 h-16 text-primary mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Venha Conferir Nossa Loja
          </h2>
          <p className="text-muted-foreground text-lg mb-6">
            Temos uma ampla variedade de acessórios em estoque. Visite nossa loja física 
            em Belo Horizonte ou entre em contato para mais informações sobre disponibilidade 
            e preços.
          </p>
          <Button variant="hero" size="lg" asChild>
            <a
              href="https://wa.me/5531986140889?text=Olá! Gostaria de saber mais sobre os acessórios disponíveis."
              target="_blank"
              rel="noopener noreferrer"
            >
              Entrar em Contato
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

