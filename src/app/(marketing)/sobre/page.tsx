import type { Metadata } from 'next'
import { Award, Users, ThumbsUp, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre Nós - Assistência Técnica em Belo Horizonte | Conectize',
  description: 'Conheça a Conectize, assistência técnica especializada em conserto de celulares em Belo Horizonte. Mais de 15 anos de experiência, técnicos certificados e garantia de 6 meses.',
  keywords: 'sobre conectize, assistência técnica belo horizonte, história empresa conserto celular, técnicos certificados bh',
  alternates: {
    canonical: 'https://conectize.com.br/sobre',
  },
}

const stats = [
  { icon: Users, value: '5.000+', label: 'Clientes Atendidos' },
  { icon: ThumbsUp, value: '98%', label: 'Satisfação' },
  { icon: Award, value: '15+', label: 'Anos de Experiência' },
  { icon: Zap, value: '24h', label: 'Tempo Médio de Reparo' },
]

export default function SobrePage () {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-6">
            Sobre Nós
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Especialistas em <span className="text-gradient">Conserto de Celulares e Eletrônicos</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Conheça nossa história e compromisso com a excelência em assistência técnica
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="bg-card rounded-2xl p-6 shadow-card text-center animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-lg">
                Somos uma assistência técnica especializada em conserto de celulares e eletrônicos,
                com cede em <strong className="text-foreground">Belo Horizonte</strong>.
                Com mais de 15 anos de experiência no mercado, nos destacamos pela qualidade
                dos nossos serviços e atendimento personalizado.
              </p>
              <p>
                Nossa equipe é formada por técnicos certificados e constantemente atualizados
                sobre as últimas tecnologias do mercado. Trabalhamos com peças de
                alta qualidade e oferecemos garantia de 6 meses em todos os serviços realizados.
              </p>
              <p>
                Atendemos todas as marcas de smartphones: iPhone, Samsung, Motorola, Xiaomi,
                LG e muitas outras. Seja troca de tela, bateria, reparo de placa ou
                qualquer outro problema, temos a solução para você.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-card rounded-2xl p-8 shadow-card">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Nossa Missão
            </h2>
            <p className="text-muted-foreground text-lg">
              Proporcionar soluções rápidas, eficientes e de qualidade para o conserto de
              dispositivos móveis, sempre priorizando a satisfação do cliente e utilizando
              as melhores práticas do mercado.
            </p>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-card">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Nossos Valores
            </h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <span>Compromisso com a qualidade e excelência técnica</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <span>Transparência e honestidade em todos os processos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <span>Atendimento personalizado e humanizado</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <span>Inovação constante e atualização tecnológica</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold">•</span>
                <span>Garantia e suporte pós-serviço</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

