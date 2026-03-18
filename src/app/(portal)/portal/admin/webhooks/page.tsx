import { redirect } from 'next/navigation'
import { getPortalAuth, createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WebhooksListClient } from './WebhooksListClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string; event_type?: string; platform?: string }>

export default async function AdminWebhooksPage ({ searchParams }: { searchParams: SearchParams }) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole !== 'admin') redirect('/portal/ordens')

  const { status, event_type, platform } = await searchParams
  const statusFilter = String(status || '').trim()
  const eventTypeFilter = String(event_type || '').trim()
  const platformFilter = String(platform || '').trim() || 'bling'

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('integration_webhooks')
    .select('id, platform_id, event_type, external_id, status, error_message, retry_count, processed_at, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(100)

  if (platformFilter) {
    query = query.eq('platform_id', platformFilter)
  }
  if (statusFilter && ['pending', 'processed', 'error'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }
  if (eventTypeFilter) {
    query = query.ilike('event_type', `%${eventTypeFilter}%`)
  }

  const { data: webhooks } = await query

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
            {webhooks && webhooks.length > 0 ? `${webhooks.length} evento(s)` : 'Nenhum webhook encontrado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks && webhooks.length > 0 ? (
            <WebhooksListClient webhooks={webhooks as any} />
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum registro.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
