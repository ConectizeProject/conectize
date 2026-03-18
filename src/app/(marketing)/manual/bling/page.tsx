import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, Link2, Package, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Manual da Integração com o Bling | Conectize',
  description: 'Passo a passo público para conectar o Conectize ao Bling, autorizar o aplicativo e sincronizar produtos.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://conectize.com.br/manual/bling',
  },
}

const requisitos = [
  'Ter uma conta ativa no Conectize.',
  'Ter uma conta no Bling com acesso para instalar e autorizar aplicativos.',
  'Possuir permissão de administrador no portal do Conectize para concluir a conexão.',
]

const passosBling = [
  'Acesse a tela de integrações no Conectize e clique em conectar o Bling.',
  'Você será redirecionado para o ambiente do Bling para autorizar o aplicativo.',
  'Revise as permissões apresentadas pelo Bling e confirme a autorização.',
  'Após a autorização, o Bling redirecionará você de volta ao Conectize para finalizar a conexão.',
]

const passosConectize = [
  'Entre no portal do Conectize com um usuário administrador.',
  'Acesse `Portal > HUB`.',
  'Na integração do Bling, clique em `Conectar`.',
  'Conclua a autorização no Bling e aguarde o retorno automático ao portal.',
  'Depois da conexão, utilize a área de produtos para importar, sincronizar e atualizar itens.',
]

const observacoes = [
  'Se os escopos do aplicativo forem alterados no Bling, será necessário autorizar a integração novamente.',
  'Se ocorrer erro de `redirect_uri_mismatch`, confira se o link de redirecionamento cadastrado no Bling corresponde exatamente ao ambiente usado.',
  'Se ocorrer erro de `insufficient_scope`, ajuste os escopos do aplicativo no Bling e reconecte a conta no HUB.',
]

export default function ManualBlingPage () {
  return (
    <div className="min-h-screen bg-secondary/20 pb-20 pt-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-4xl text-center">
          <span className="mb-6 inline-block text-sm font-semibold uppercase tracking-wider text-primary-accessible">
            Manual Público
          </span>
          <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
            Integração do <span className="text-gradient">Conectize com o Bling</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Este manual apresenta o fluxo público de autorização e uso da integração entre o
            Conectize e o Bling para sincronização de produtos e operações relacionadas.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
                  <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Requisitos</h2>
                  <p className="text-sm text-muted-foreground">Antes de iniciar a integração.</p>
                </div>
              </div>
              <ul className="space-y-3 text-muted-foreground">
                {requisitos.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="pt-1 text-primary-accessible">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
                  <Package className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Passos no Bling</h2>
                  <p className="text-sm text-muted-foreground">Autorização do aplicativo.</p>
                </div>
              </div>
              <ol className="space-y-4 text-muted-foreground">
                {passosBling.map((item, index) => (
                  <li key={item} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-accessible">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
                  <Link2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Passos no Conectize</h2>
                  <p className="text-sm text-muted-foreground">Finalização da conexão no portal.</p>
                </div>
              </div>
              <ol className="space-y-4 text-muted-foreground">
                {passosConectize.map((item, index) => (
                  <li key={item} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-accessible">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Observações importantes</h2>
              <ul className="space-y-3 text-muted-foreground">
                {observacoes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="pt-1 text-primary-accessible">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Documentação de apoio</h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="https://developer.bling.com.br/bling-api" target="_blank" rel="noopener noreferrer">
                    Documentação oficial da API do Bling
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="https://developer.bling.com.br/aplicativos" target="_blank" rel="noopener noreferrer">
                    Manual oficial de aplicativos do Bling
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Suporte</h2>
              <p className="mb-6 text-muted-foreground">
                Se precisar de ajuda na configuração ou autorização da integração, fale com a equipe
                da Conectize.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/contato">Falar com o suporte</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/portal">Acessar o portal</Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
