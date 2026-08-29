import { requireRealAdminPage } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WebhooksListClient, type WebhookRow } from './WebhooksListClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  status?: string
  event_type?: string
  platform?: string
  page?: string
  pageSize?: string
}>

/** Sem payload: listagem rápida. Detalhe carrega sob demanda. */
const LIST_COLUMNS =
  'id, platform_id, event_type, external_id, status, error_message, retry_count, created_at'

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

function parsePageSize (raw: string | undefined): number {
  const n = Number.parseInt(String(raw || ''), 10)
  if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) return n
  return 25
}

export default async function AdminWebhooksPage ({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireRealAdminPage()
  const { organizationId } = auth
  // Service role após auth: evita custo de RLS por linha em tabelas grandes.
  const supabase = createSupabaseServiceClient()

  const { status, event_type, platform, page, pageSize: pageSizeRaw } = await searchParams
  const statusFilter = String(status || '').trim()
  const eventTypeFilter = String(event_type || '').trim()
  const platformFilter = String(platform || '').trim() || 'bling'
  const pageSize = parsePageSize(pageSizeRaw)
  const pageRaw = Number.parseInt(String(page || '1'), 10)
  const currentPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const from = (currentPage - 1) * pageSize
  // +1 para saber se existe próxima página sem COUNT(*)
  const to = from + pageSize

  let listQuery = supabase
    .from('integration_webhooks')
    .select(LIST_COLUMNS)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (platformFilter) {
    listQuery = listQuery.eq('platform_id', platformFilter)
  }
  if (statusFilter && ['pending', 'processed', 'error'].includes(statusFilter)) {
    listQuery = listQuery.eq('status', statusFilter)
  }
  if (eventTypeFilter) {
    // Prefixo é bem mais barato que %termo% em tabelas grandes.
    listQuery = listQuery.ilike('event_type', `${eventTypeFilter}%`)
  }

  const listRes = await listQuery
  const rows = (listRes.data ?? []) as WebhookRow[]
  const listError = listRes.error?.message || null
  const hasNextPage = rows.length > pageSize
  const webhooks = hasNextPage ? rows.slice(0, pageSize) : rows
  const hasPrevPage = currentPage > 1
  const rangeStart = webhooks.length === 0 ? 0 : from + 1
  const rangeEnd = from + webhooks.length

  const buildHref = (opts: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (platformFilter) qs.set('platform', platformFilter)
    if (statusFilter) qs.set('status', statusFilter)
    if (eventTypeFilter) qs.set('event_type', eventTypeFilter)
    const nextPageSize = opts.pageSize ?? pageSize
    if (nextPageSize !== 25) qs.set('pageSize', String(nextPageSize))
    const nextPage = opts.page ?? currentPage
    if (nextPage > 1) qs.set('page', String(nextPage))
    const tail = qs.toString()
    return tail ? `/portal/admin/webhooks?${tail}` : '/portal/admin/webhooks'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks recebidos</h1>
        <p className="text-sm text-muted-foreground">
          Eventos enviados pelo Bling, Mercado Livre e outras integrações. Status, erro e opção de reprocessar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre por status, tipo de evento e quantidade por página.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/admin/webhooks" method="get" className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="platform" className="text-sm font-medium">Plataforma</label>
              <select
                id="platform"
                name="platform"
                defaultValue={platformFilter}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="bling">Bling</option>
                <option value="mercado_livre">Mercado Livre</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">Status</label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="processed">Processado</option>
                <option value="error">Erro</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="event_type" className="text-sm font-medium">Tipo de evento</label>
              <input
                id="event_type"
                name="event_type"
                type="text"
                defaultValue={eventTypeFilter}
                placeholder="Ex: product.created"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pageSize" className="text-sm font-medium">Por página</label>
              <select
                id="pageSize"
                name="pageSize"
                defaultValue={String(pageSize)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Filtrar
              </button>
              <a
                href={`/portal/admin/webhooks?platform=${encodeURIComponent(platformFilter)}`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent"
              >
                Limpar
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {listError
              ? 'Não foi possível carregar os webhooks.'
              : webhooks.length > 0
                ? `Mostrando ${rangeStart}–${rangeEnd} · página ${currentPage}${hasNextPage ? '+' : ''}`
                : 'Nenhum webhook encontrado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {listError}
            </div>
          ) : (
            <div className="space-y-4">
              <WebhooksListClient webhooks={webhooks} platform={platformFilter} />
              {webhooks.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum registro.</div>
              ) : null}
              {webhooks.length > 0 && (hasPrevPage || hasNextPage) ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {currentPage}
                    {hasNextPage ? ' · há mais resultados' : ''}
                  </p>
                  <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationLink
                          href={buildHref({ page: currentPage - 1 })}
                          size="default"
                          aria-label="Página anterior"
                          aria-disabled={!hasPrevPage}
                          className={cn('gap-1 pl-2.5', !hasPrevPage && 'pointer-events-none opacity-50')}
                          tabIndex={!hasPrevPage ? -1 : undefined}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Anterior</span>
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href={buildHref({ page: currentPage })}
                          isActive
                          size="icon"
                        >
                          {currentPage}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href={buildHref({ page: currentPage + 1 })}
                          size="default"
                          aria-label="Próxima página"
                          aria-disabled={!hasNextPage}
                          className={cn('gap-1 pr-2.5', !hasNextPage && 'pointer-events-none opacity-50')}
                          tabIndex={!hasNextPage ? -1 : undefined}
                        >
                          <span>Próxima</span>
                          <ChevronRight className="h-4 w-4" />
                        </PaginationLink>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
