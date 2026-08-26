import Link from 'next/link'
import type { ReactNode } from 'react'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { parseQuoteItemsRaw } from '@/lib/quotes/quote-items'
import { OrcamentoPublicPrintButton } from './OrcamentoPublicPrintButton'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

function getCustomer (quote: { customers?: unknown }) {
  const customer = quote?.customers
  if (Array.isArray(customer)) return customer[0] || null
  return customer || null
}

function PublicShell ({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center p-6 pt-32">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default async function OrcamentoPublicoPage ({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token) {
    return (
      <PublicShell>
        <Card className="w-full max-w-md">
          <CardHeader className="p-5">
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              O link do orçamento não é válido. Verifique e tente novamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Button asChild variant="outline">
              <Link href="/">Ir para o início</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    )
  }

  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch {
    return (
      <PublicShell>
        <Card className="w-full max-w-md">
          <CardHeader className="p-5">
            <CardTitle>Indisponível</CardTitle>
            <CardDescription>
              Não foi possível carregar o orçamento no momento.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicShell>
    )
  }

  const { data: quote } = await supabase
    .from('quotes')
    .select(
      `id, organization_id, display_number, status, title, notes, items, items_total_cents, valid_until, created_at,
       customers ( cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, address_full )`,
    )
    .eq('share_token', token)
    .maybeSingle()

  if (!quote) {
    return (
      <PublicShell>
        <Card className="w-full max-w-md">
          <CardHeader className="p-5">
            <CardTitle>Orçamento não encontrado</CardTitle>
            <CardDescription>
              Este link pode ter expirado ou sido revogado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Button asChild variant="outline">
              <Link href="/">Ir para o início</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    )
  }

  const customer = getCustomer(quote) as Record<string, unknown> | null
  const { data: orgRow } = quote.organization_id
    ? await supabase
      .from('organizations')
      .select('slug, is_host, name, logo_url, phone, email')
      .eq('id', quote.organization_id)
      .maybeSingle()
    : { data: null }
  const isHostOrg = Boolean(orgRow?.is_host)
  const items = parseQuoteItemsRaw(quote.items)
  const totalCents = Math.max(0, Number(quote.items_total_cents) || 0)
  const customerName = customer?.is_company
    ? String(customer.company_name || customer.trade_name || customer.full_name || '')
    : String(customer.full_name || '')
  const doc = customer?.is_company
    ? String(customer.cnpj || '')
    : String(customer.cpf || '')

  const inner = (
    <main className="flex-1">
      <div className={`container max-w-3xl px-4 py-8 pb-20 ${isHostOrg ? 'pt-32' : 'pt-10'}`}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                Orçamento #{quote.display_number ?? ''}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {quote.title || 'Orçamento'}
                {customerName ? ` • ${customerName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OrcamentoPublicPrintButton token={token} />
            </div>
          </div>

          <Card>
            <CardHeader className="p-5">
              <CardTitle>Detalhes</CardTitle>
              <CardDescription>
                Data: {formatDateBr(quote.created_at)}
                {quote.valid_until
                  ? ` • Validade: ${formatDateBr(`${String(quote.valid_until).slice(0, 10)}T12:00:00-03:00`)}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-5 pt-0">
              <section>
                <h2 className="mb-2 text-sm font-semibold">Cliente</h2>
                <p>{customerName || '—'}</p>
                {doc ? (
                  <p className="text-sm text-muted-foreground">{formatCpfCnpj(doc)}</p>
                ) : null}
              </section>

              <section>
                <h2 className="mb-2 text-sm font-semibold">Itens</h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item, index) => {
                      const qty =
                        item.kind === 'product' && (item.quantity || 1) > 1
                          ? ` × ${item.quantity}`
                          : ''
                      const lineCents =
                        Math.max(0, Number(item.unitValueCents) || 0) *
                        Math.max(1, Number(item.quantity) || 1)
                      return (
                        <li
                          key={`${item.description}-${index}`}
                          className="flex justify-between gap-4 text-sm"
                        >
                          <span>
                            {item.description || 'Item'}
                            {qty}
                          </span>
                          <span className="tabular-nums">{formatCentsBr(lineCents)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-3 text-right font-semibold tabular-nums">
                  Total: {formatCentsBr(totalCents)}
                </p>
              </section>

              {quote.notes ? (
                <section>
                  <h2 className="mb-2 text-sm font-semibold">Observações</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {quote.notes}
                  </p>
                </section>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )

  if (isHostOrg) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        {inner}
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="flex flex-col items-center gap-2 border-b bg-background px-4 py-5">
        {orgRow?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={String(orgRow.logo_url)}
            alt={String(orgRow.name || 'Logo')}
            width={220}
            height={40}
            loading="eager"
            decoding="async"
            className="h-10 w-auto max-w-[220px] object-contain"
          />
        ) : null}
        {orgRow?.name ? (
          <span className="text-center text-lg font-semibold">{String(orgRow.name)}</span>
        ) : null}
        {orgRow?.phone || orgRow?.email ? (
          <p className="text-center text-sm text-muted-foreground">
            {[orgRow.phone, orgRow.email].filter(Boolean).join(' • ')}
          </p>
        ) : null}
      </header>
      {inner}
    </div>
  )
}
