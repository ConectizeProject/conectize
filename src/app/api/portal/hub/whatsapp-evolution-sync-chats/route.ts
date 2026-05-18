import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  findEvolutionHubByConnectionId,
  type WhatsappEvolutionHubMetadata,
} from '@/lib/whatsapp/evolution-hub-config'
import { syncEvolutionChatsForOrganization } from '@/lib/whatsapp/sync-evolution-chats'

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    connection_id?: string
    limit?: number
  } | null

  const connectionId = String(body?.connection_id || '').trim()
  const limit = typeof body?.limit === 'number' ? body.limit : undefined

  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'connection_id_required' }, { status: 400 })
  }

  const hub = await findEvolutionHubByConnectionId(
    auth.supabase,
    connectionId,
    auth.organizationId,
  )
  if (!hub) {
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  }

  const result = await syncEvolutionChatsForOrganization({
    supabase,
    organizationId: auth.organizationId,
    hubConnectionId: hub.id,
    metadata: hub.metadata,
    accessToken: hub.access_token,
    limit,
  })

  if (result.ok === false) {
    const hints: Record<string, string> = {
      whatsapp_evolution_not_configured:
        'Configure WHATSAPP_EVOLUTION_API_URL e a API key (ou salve no hub).',
      db_upsert_failed:
        'Não foi possível gravar conversas no banco. Aplique a migration supabase/migrations/20260516120000_whatsapp_multi_evolution_instances.sql no Supabase.',
    }
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        hint: hints[result.error],
      },
      { status: result.status === 401 ? 401 : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    instance_name: hub.metadata.instance_name,
    ...result,
    migration_recommended: result.legacy_schema === true,
    hint:
      result.legacy_schema === true
        ? 'Sync funcionou em modo legado. Para separar várias instâncias na inbox, aplique a migration 20260516120000_whatsapp_multi_evolution_instances.sql no Supabase.'
        : undefined,
  })
}
