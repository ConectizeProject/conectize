import { requireRealAdminPage } from '@/lib/auth/portal-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WebhooksListClient, type WebhookRow } from './WebhooksListClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string; event_type?: string; platform?: string; page?: string }>

export default async function AdminWebhooksPage ({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireRealAdminPage()
  const { supabase, organizationId } = auth

  const { status, event_type, platform, page } = await searchParams
  const statusFilter = String(status || '').trim()
  const eventTypeFilter = String(event_type || '').trim()
  const platformFilter = String(platform || '').trim() || 'bling'
  const pageSize = 100
  const pageRaw = Number.parseInt(String(page || '1'), 10)
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  let countQuery = supabase
    .from('integration_webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (platformFilter) {
    countQuery = countQuery.eq('platform_id', platformFilter)
  }
  if (statusFilter && ['pending', 'processed', 'error'].includes(statusFilter)) {
    countQuery = countQuery.eq('status', statusFilter)
  }
  if (eventTypeFilter) {
    countQuery = countQuery.ilike('event_type', `%${eventTypeFilter}%`)
  }

  const { count } = await countQuery
  const totalItems = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  let listQuery = supabase
    .from('integration_webhooks')
    .select('id, platform_id, event_type, external_id, status, error_message, retry_count, processed_at, created_at, payload')
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
    listQuery = listQuery.ilike('event_type', `%${eventTypeFilter}%`)
  }

  const { data: webhooks } = await listQuery

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    if (platformFilter) qs.set('platform', platformFilter)
    if (statusFilter) qs.set('status', statusFilter)
    if (eventTypeFilter) qs.set('event_type', eventTypeFilter)
    if (targetPage > 1) qs.set('page', String(targetPage))
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
          <CardDescription>Filtre por status ou tipo de evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/admin/webhooks" method="get" className="grid gap-4 md:grid-cols-4">
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
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Filtrar
              </button>
              <a
                href="/portal/admin/webhooks"
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
            {totalItems > 0
              ? `${totalItems} evento(s) • página ${currentPage} de ${totalPages}`
              : 'Nenhum webhook encontrado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-4">
              <WebhooksListClient webhooks={(webhooks ?? []) as WebhookRow[]} />
              <div className="flex items-center justify-end gap-2">
                <a
                  href={buildPageHref(currentPage - 1)}
                  aria-disabled={currentPage <= 1}
                  className={
                    currentPage <= 1
                      ? 'inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium text-muted-foreground pointer-events-none opacity-50'
                      : 'inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent'
                  }
                >
                  Anterior
                </a>
                <a
                  href={buildPageHref(currentPage + 1)}
                  aria-disabled={currentPage >= totalPages}
                  className={
                    currentPage >= totalPages
                      ? 'inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium text-muted-foreground pointer-events-none opacity-50'
                      : 'inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent'
                  }
                >
                  Próxima
                </a>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum registro.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
