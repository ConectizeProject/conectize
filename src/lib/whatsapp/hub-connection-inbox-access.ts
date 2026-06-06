import type { SupabaseClient } from '@supabase/supabase-js'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'

export type InboxViewerUser = {
  user_id: string
  email: string | null
  full_name: string | null
  role: string | null
}

export type HubInboxAccessMeta = {
  restricted: boolean
  viewer_user_ids: string[]
  viewers: InboxViewerUser[]
}

export async function loadHubInboxAccessMeta (
  supabase: SupabaseClient,
  hubConnectionId: string,
): Promise<HubInboxAccessMeta> {
  const empty: HubInboxAccessMeta = {
    restricted: false,
    viewer_user_ids: [],
    viewers: [],
  }

  const { data: rows, error } = await supabase
    .from('hub_connection_inbox_viewers')
    .select('user_id, users ( id, email, full_name, role )')
    .eq('hub_connection_id', hubConnectionId)
    .order('created_at', { ascending: true })

  if (error) {
    const code = String((error as { code?: string }).code || '')
    if (code === '42P01' || code === 'PGRST205') return empty
    console.warn('[hub-inbox-access] load viewers', error.message)
    return empty
  }

  const viewerRows = rows || []
  const viewer_user_ids = viewerRows.map((r) => String(r.user_id))
  const viewers: InboxViewerUser[] = viewerRows.map((r) => {
    const u = r.users as {
      id?: string
      email?: string | null
      full_name?: string | null
      role?: string | null
    } | null
    return {
      user_id: String(r.user_id),
      email: u?.email ?? null,
      full_name: u?.full_name ?? null,
      role: u?.role ?? null,
    }
  })

  return {
    restricted: viewer_user_ids.length > 0,
    viewer_user_ids,
    viewers,
  }
}

export async function replaceHubInboxViewers (
  supabase: SupabaseClient,
  organizationId: string,
  hubConnectionId: string,
  userIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unique = [...new Set(userIds.filter(Boolean))]

  const { error: delErr } = await supabase
    .from('hub_connection_inbox_viewers')
    .delete()
    .eq('hub_connection_id', hubConnectionId)

  if (delErr) return { ok: false, error: 'db_error' }

  if (unique.length === 0) return { ok: true }

  const { error: insErr } = await supabase.from('hub_connection_inbox_viewers').insert(
    unique.map((user_id) => ({
      organization_id: organizationId,
      hub_connection_id: hubConnectionId,
      user_id,
    })),
  )

  if (insErr) return { ok: false, error: 'db_error' }
  return { ok: true }
}

/** hub_connection_id → user_ids permitidos; chave ausente ou lista vazia no mapa = sem restrição. */
export async function loadHubInboxViewerIndex (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Map<string, string[]>> {
  const { data: rows } = await supabase
    .from('hub_connection_inbox_viewers')
    .select('hub_connection_id, user_id')
    .eq('organization_id', organizationId)

  const index = new Map<string, string[]>()
  for (const row of rows || []) {
    const hid = String(row.hub_connection_id)
    const list = index.get(hid) || []
    list.push(String(row.user_id))
    index.set(hid, list)
  }
  return index
}

export function userCanViewHubInbox (
  hubConnectionId: string | null | undefined,
  viewerIndex: Map<string, string[]>,
  userId: string,
  isOrgAdmin: boolean,
): boolean {
  if (isOrgAdmin) return true
  if (!hubConnectionId) return true
  const allowed = viewerIndex.get(hubConnectionId)
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(userId)
}

export async function assertHubConnectionAdmin (
  supabase: SupabaseClient,
  organizationId: string,
  hubConnectionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: hub } = await supabase
    .from('hub_connections')
    .select('id')
    .eq('id', hubConnectionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!hub) return { ok: false, error: 'not_found' }
  return { ok: true }
}

export type WhatsappConversationAccess =
  | { ok: true; conversationId: string }
  | { ok: false; status: number; error: string }

export async function assertWhatsappConversationAccess (
  auth: PortalAuthStaffSuccess,
  conversationId: string,
): Promise<WhatsappConversationAccess> {
  const { data: conv, error } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()

  if (error) return { ok: false, status: 500, error: 'db_error' }
  if (!conv) return { ok: false, status: 404, error: 'not_found' }
  return { ok: true, conversationId }
}
