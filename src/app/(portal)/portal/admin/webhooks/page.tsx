import { requireRealAdminPage } from '@/lib/auth/portal-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
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

const LIST_COLUMNS =
  'id, platform_id, event_type, external_id, status, error_message, retry_count, processed_at, created_at'

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

function parsePageSize (raw: string | undefined): number {
  const n = Number.parseInt(String(raw || ''), 10)
  if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) return n
  return 50
}

function buildPageWindow (currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  const window: Array<number | 'ellipsis'> = []
  for (const page of sorted) {
    const prev = window[window.length - 1]
    if (typeof prev === 'number' && page - prev > 1) {
      window.push('ellipsis')
    }
    window.push(page)
  }
  return window
}

function applyWebhookFilters<T extends {
  eq: (column: string, value: string) => T
  ilike: (column: string, pattern: string) => T
}> (
  query: T,
  opts: {
    organizationId: string
    platformFilter: string
    statusFilter: string
    eventTypeFilter: string
  },
): T {
  let next = query.eq('organization_id', opts.organizationId)
  if (opts.platformFilter) next = next.eq('platform_id', opts.platformFilter)
  if (opts.statusFilter && ['pending', 'processed', 'error'].includes(opts.statusFilter)) {
    next = next.eq('status', opts.statusFilter)
  }
  if (opts.eventTypeFilter) {
    next = next.ilike('event_type', `%${opts.eventTypeFilter}%`)
  }
  return next
}

export default async function AdminWebhooksPage ({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireRealAdminPage()
  const { supabase, organizationId } = auth

  const { status, event_type, platform, page, pageSize: pageSizeRaw } = await searchParams
  const statusFilter = String(status || '').trim()
  const eventTypeFilter = String(event_type || '').trim()
  const platformFilter = String(platform || '').trim() || 'bling'
  const pageSize = parsePageSize(pageSizeRaw)
  const pageRaw = Number.parseInt(String(page || '1'), 10)
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const filters = {
    organizationId,
    platformFilter,
    statusFilter,
    eventTypeFilter,
  }

  const countRes = await applyWebhookFilters(
    supabase
      .from('integration_webhooks')
      .select('id', { count: 'exact', head: true }),
    filters,
  )

  const totalItems = countRes.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const currentPage = Math.min(requestedPage, totalPages)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  const listRes = await applyWebhookFilters(
    supabase
      .from('integration_webhooks')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false }),
    filters,
  ).range(from, to)

  const webhooks = (listRes.data ?? []) as WebhookRow[]
  const listError = listRes.error?.message || countRes.error?.message || null
  const rangeStart = totalItems === 0 ? 0 : from + 1
  const rangeEnd = Math.min(from + webhooks.length, totalItems)
  const pageWindow = buildPageWindow(currentPage, totalPages)

  const buildHref = (opts: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (platformFilter) qs.set('platform', platformFilter)
    if (statusFilter) qs.set('status', statusFilter)
    if (eventTypeFilter) qs.set('event_type', eventTypeFilter)
    const nextPageSize = opts.pageSize ?? pageSize
    if (nextPageSize !== 50) qs.set('pageSize', String(nextPageSize))
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
          Eventos enviados pelo Bling (e outras integrações). Status, erro e opção de reprocessar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre por status, tipo de evento e quantidade por página.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/admin/webhooks" method="get" className="grid gap-4 md:grid-cols-5">
            <input type="hidden" name="platform" value={platformFilter} />
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
                placeholder="Ex: produto.updated"
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
              : totalItems > 0
                ? `Mostrando ${rangeStart}–${rangeEnd} de ${totalItems} · página ${currentPage} de ${totalPages}`
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
              {webhooks.length > 0 && totalPages > 1 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {rangeStart}–{rangeEnd} de {totalItems}
                  </p>
                  <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationLink
                          href={buildHref({ page: currentPage - 1 })}
                          size="default"
                          aria-label="Página anterior"
                          aria-disabled={currentPage <= 1}
                          className={cn('gap-1 pl-2.5', currentPage <= 1 && 'pointer-events-none opacity-50')}
                          tabIndex={currentPage <= 1 ? -1 : undefined}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Anterior</span>
                        </PaginationLink>
                      </PaginationItem>

                      {pageWindow.map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {item === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href={buildHref({ page: item })}
                              isActive={item === currentPage}
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationLink
                          href={buildHref({ page: currentPage + 1 })}
                          size="default"
                          aria-label="Próxima página"
                          aria-disabled={currentPage >= totalPages}
                          className={cn('gap-1 pr-2.5', currentPage >= totalPages && 'pointer-events-none opacity-50')}
                          tabIndex={currentPage >= totalPages ? -1 : undefined}
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
