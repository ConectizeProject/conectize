import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileBadge,
  Layers,
  Percent,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Planos — Conectize',
  description:
    'Sistema completo para assistências técnicas: ordens de serviço, clientes, estoque, revenda, financeiro, WhatsApp e integrações. Tudo isolado por empresa.',
}

const heroBenefits = [
  'Ordens com numeração própria (começa do #1 na sua empresa)',
  'Link público da OS com a identidade da sua marca',
  'Seus dados totalmente isolados dos demais lojistas',
  'Acesso web responsivo para celular, tablet e desktop',
]

const featureCards = [
  {
    icon: ClipboardList,
    title: 'Ordens de serviço',
    description:
      'Crie, edite e finalize OS com status personalizados, fotos de entrada e saída, termos de garantia e histórico completo.',
  },
  {
    icon: Users,
    title: 'Clientes e dispositivos',
    description:
      'CPF/CNPJ únicos, histórico por cliente, cadastro de aparelhos, senhas e condições de entrada organizadas.',
  },
  {
    icon: Boxes,
    title: 'Catálogo e estoque',
    description:
      'Produtos e serviços por empresa, controle de custo/margem, movimentações automáticas ao finalizar OS.',
  },
  {
    icon: Smartphone,
    title: 'Revenda de aparelhos',
    description:
      'Seminovos e lacrados, fotos, preço por condição/cor, margem real e vitrine pública para lojistas parceiros.',
  },
  {
    icon: Wallet,
    title: 'Financeiro completo',
    description:
      'Contas, entradas e saídas, formas de pagamento com taxa, conciliação por OS e por aparelho vendido.',
  },
  {
    icon: Percent,
    title: 'Tabela de preços',
    description:
      'Preços sugeridos por marca/modelo, tags de precificação e catálogo comercial para sua equipe.',
  },
  {
    icon: Bot,
    title: 'WhatsApp integrado',
    description:
      'Conversas por cliente, criação de orçamento a partir do chat e envio do link público da OS.',
  },
  {
    icon: Layers,
    title: 'Integrações (Bling e HUB)',
    description:
      'Sincronize produtos e estoque com o Bling, controle webhooks recebidos e conecte sua operação.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios executivos',
    description:
      'Faturamento por período, margem, ranking de modelos vendidos, SLA médio e comissões por colaborador.',
  },
]

const differentiators = [
  {
    icon: Building2,
    title: 'Multi-empresa de verdade',
    description:
      'Cada empresa tem dados isolados por RLS no banco: OS, clientes, aparelhos, estoque e financeiro só aparecem para a própria organização.',
  },
  {
    icon: ShieldCheck,
    title: 'Papéis e permissões',
    description:
      'Admin, staff, lojista parceiro e cliente final com telas e permissões diferentes. Você decide quem vê o quê.',
  },
  {
    icon: FileBadge,
    title: 'Página pública da OS',
    description:
      'Compartilhe um link com o cliente contendo status, aparelho, prazo estimado e CTA com a sua marca.',
  },
  {
    icon: Sparkles,
    title: 'Onboarding imediato',
    description:
      'Ao criar a empresa, formas de pagamento padrão já vêm prontas e seu usuário admin entra direto no portal.',
  },
]

const steps = [
  {
    title: 'Crie sua conta',
    description:
      'Informe razão social, CNPJ, seu nome e senha. Em segundos sua empresa é provisionada no sistema.',
  },
  {
    title: 'Personalize a operação',
    description:
      'Ajuste formas de pagamento, cadastre aparelhos, equipe, garantias e o logo que aparece na OS pública.',
  },
  {
    title: 'Comece a vender e atender',
    description:
      'Abra OS, cadastre clientes, controle estoque e acompanhe relatórios em tempo real.',
  },
]

const faqItems = [
  {
    q: 'Meus dados ficam junto com os de outras empresas?',
    a: 'Não. Cada empresa tem seu próprio escopo de dados (organização). A plataforma usa RLS no banco, então OS, clientes, estoque e financeiro só são visíveis para usuários vinculados à sua empresa.',
  },
  {
    q: 'Posso ter vários usuários da minha equipe?',
    a: 'Sim. Você (admin) pode criar usuários staff para atender, lançar OS, controlar estoque e gerar relatórios. Cada usuário tem seu próprio acesso.',
  },
  {
    q: 'Consigo integrar com o Bling?',
    a: 'Sim. O HUB da plataforma permite conectar ao Bling via OAuth para sincronizar produtos e estoque, além de receber webhooks de atualização.',
  },
  {
    q: 'A OS pública mostra a minha marca?',
    a: 'Sim. O link público da OS exibe o nome e logo da sua empresa, não a marca da Conectize, e o CTA leva o cliente ao seu próprio cadastro.',
  },
  {
    q: 'Como começo?',
    a: 'Clique em "Criar conta da empresa", preencha os dados e você já entra logado como admin da sua organização, pronto para operar.',
  },
]

export default function PlanosPage () {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Ir para página inicial">
            <Image
              src="/logo_conectize.svg"
              alt="Conectize"
              width={90}
              height={24}
              className="h-6 w-auto"
              priority
              sizes="90px"
            />
            <span className="hidden text-sm font-semibold sm:inline">
              Conectize
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Seções da página de planos">
            <a href="#recursos" className="hover:text-foreground">
              Recursos
            </a>
            <a href="#diferenciais" className="hover:text-foreground">
              Diferenciais
            </a>
            <a href="#como-comecar" className="hover:text-foreground">
              Como começar
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/portal/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/cadastro-empresa">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/40" />
          <div className="container relative px-4 py-16 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4">
                Plataforma de gestão para assistências técnicas
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Sua assistência rodando no{' '}
                <span className="text-primary">mesmo sistema</span> que a
                Conectize usa
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                Ordens de serviço, clientes, estoque, revenda, financeiro,
                WhatsApp e integrações — tudo no mesmo ambiente, com a sua
                marca e totalmente isolado das demais empresas.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/cadastro-empresa">
                    Criar conta da empresa
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/portal/login">Já tenho conta</Link>
                </Button>
              </div>

              <ul className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
                {heroBenefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-b">
          <div className="container px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tudo que sua assistência precisa no mesmo lugar
              </h2>
              <p className="mt-3 text-muted-foreground">
                Do primeiro contato com o cliente até a conciliação financeira
                do mês. Pare de pular entre planilhas, grupos de WhatsApp e
                sistemas separados.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((f) => {
                const Icon = f.icon
                return (
                  <Card key={f.title} className="h-full">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-base">{f.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {f.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="border-b bg-muted/30">
          <div className="container px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Feito para crescer com a sua operação
              </h2>
              <p className="mt-3 text-muted-foreground">
                Arquitetura multi-empresa de verdade, com permissões,
                integrações e página pública da OS com a sua identidade.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {differentiators.map((d) => {
                const Icon = d.icon
                return (
                  <div
                    key={d.title}
                    className="flex gap-4 rounded-lg border bg-background p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{d.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {d.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b">
          <div className="container grid gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <Badge variant="outline">Plano único</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Simples, previsível e sem surpresas
              </h2>
              <p className="text-muted-foreground">
                Um plano com todos os módulos liberados. Sem diferenças entre
                versões, sem upgrade escondido atrás de recurso crítico.
              </p>
              <ul className="grid gap-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Usuários staff ilimitados para sua equipe</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>OS e clientes sem limite de volume</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Integrações Bling, HUB e webhooks inclusos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Página pública da OS com a sua marca</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Atualizações contínuas sem custo adicional</span>
                </li>
              </ul>
            </div>

            <Card className="border-primary/40 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Conectize Pro</CardTitle>
                  <Badge>Recomendado</Badge>
                </div>
                <CardDescription>
                  Acesso total à plataforma, para a sua empresa e sua equipe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    Sob consulta
                  </span>
                </div>
                <Separator />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Financeiro completo por empresa</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ClipboardList className="mt-0.5 h-4 w-4 text-primary" />
                    <span>OS com fotos, termos e status próprios</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Bot className="mt-0.5 h-4 w-4 text-primary" />
                    <span>WhatsApp integrado para atendimento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Relatórios executivos</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button asChild className="w-full" size="lg">
                  <Link href="/cadastro-empresa">Criar conta da empresa</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/contato">Falar com vendas</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <section id="como-comecar" className="border-b bg-muted/30">
          <div className="container px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Pronto em 3 passos
              </h2>
              <p className="mt-3 text-muted-foreground">
                Sem instalação, sem migração demorada. Sua empresa entra ativa
                já com os padrões operacionais.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step, idx) => (
                <Card key={step.title} className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {step.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-b">
          <div className="container px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Perguntas frequentes
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Dúvidas comuns antes de criar a conta da empresa.
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, idx) => (
                  <AccordionItem key={item.q} value={`item-${idx}`}>
                    <AccordionTrigger className="text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        <section>
          <div className="container px-4 py-16 sm:py-20">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-muted/30">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Pronto para profissionalizar sua assistência?
                </h2>
                <p className="max-w-2xl text-muted-foreground">
                  Crie sua conta agora, provisione sua empresa em segundos e
                  comece a atender com a Conectize ainda hoje.
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="gap-2">
                    <Link href="/cadastro-empresa">
                      Criar conta da empresa
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/portal/login">Entrar no portal</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container flex flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} Conectize. Todos os direitos
            reservados.
          </span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground">
              Site institucional
            </Link>
            <Link href="/portal/login" className="hover:text-foreground">
              Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
