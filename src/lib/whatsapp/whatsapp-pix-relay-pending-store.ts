import type { SupabaseClient } from '@supabase/supabase-js'

export type PixRelayPendingRow = {
  id: string
  organization_id: string
  hub_connection_id: string
  instance_name: string
  requester_wa_from: string
  amount_display: string
  gerar_command: string
  pix_group_jid: string
  status: 'pending' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

const memoryPending = new Map<string, PixRelayPendingRow>()

function isMissingTableError (error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === '42P01'
    || code === 'PGRST205'
    || msg.includes('whatsapp_pix_relay_pending')
  )
}

function pruneMemory (organizationId: string, instanceName: string, pixGroupJid: string, maxAgeMs: number) {
  const since = Date.now() - maxAgeMs
  for (const [id, row] of memoryPending) {
    if (row.organization_id !== organizationId) continue
    if (row.instance_name !== instanceName) continue
    if (row.pix_group_jid !== pixGroupJid) continue
    if (new Date(row.created_at).getTime() < since) memoryPending.delete(id)
  }
}

export async function insertPixRelayPending (
  supabase: SupabaseClient,
  row: Omit<PixRelayPendingRow, 'id' | 'created_at' | 'completed_at' | 'status'> & {
    status?: PixRelayPendingRow['status']
  },
): Promise<{ ok: true; id: string; storage: 'db' | 'memory' } | { ok: false; reason: string }> {
  const payload = {
    organization_id: row.organization_id,
    hub_connection_id: row.hub_connection_id,
    instance_name: row.instance_name,
    requester_wa_from: row.requester_wa_from,
    amount_display: row.amount_display,
    gerar_command: row.gerar_command,
    pix_group_jid: row.pix_group_jid,
    status: row.status || 'pending',
  }

  const { data, error } = await supabase
    .from('whatsapp_pix_relay_pending')
    .insert(payload)
    .select('id')
    .single()

  if (!error && data?.id) {
    return { ok: true, id: String(data.id), storage: 'db' }
  }

  if (!isMissingTableError(error)) {
    return {
      ok: false,
      reason: String(error?.message || error?.code || 'insert_failed'),
    }
  }

  const id = crypto.randomUUID()
  memoryPending.set(id, {
    id,
    ...payload,
    status: 'pending',
    created_at: new Date().toISOString(),
    completed_at: null,
  })
  console.warn('[whatsapp-pix-relay] tabela ausente; pendência em memória', id)
  return { ok: true, id, storage: 'memory' }
}

export async function fetchOldestPixRelayPending (
  supabase: SupabaseClient,
  opts: {
    organizationId: string
    instanceName: string
    pixGroupJid: string
    maxAgeMs: number
  },
): Promise<Pick<PixRelayPendingRow, 'id' | 'requester_wa_from' | 'amount_display'> | null> {
  const since = new Date(Date.now() - opts.maxAgeMs).toISOString()

  const { data: rows, error } = await supabase
    .from('whatsapp_pix_relay_pending')
    .select('id, requester_wa_from, amount_display')
    .eq('organization_id', opts.organizationId)
    .eq('instance_name', opts.instanceName)
    .eq('pix_group_jid', opts.pixGroupJid)
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!error && rows?.[0]?.id) {
    const row = rows[0]
    return {
      id: String(row.id),
      requester_wa_from: String(row.requester_wa_from),
      amount_display: String(row.amount_display),
    }
  }

  if (!isMissingTableError(error)) {
    console.error('[whatsapp-pix-relay] load pending', error?.message)
    return null
  }

  pruneMemory(opts.organizationId, opts.instanceName, opts.pixGroupJid, opts.maxAgeMs)
  const match = [...memoryPending.values()]
    .filter(
      (r) =>
        r.organization_id === opts.organizationId
        && r.instance_name === opts.instanceName
        && r.pix_group_jid === opts.pixGroupJid
        && r.status === 'pending'
        && r.created_at >= since,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]

  if (!match) return null
  return {
    id: match.id,
    requester_wa_from: match.requester_wa_from,
    amount_display: match.amount_display,
  }
}

export async function completePixRelayPending (
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_pix_relay_pending')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)

  if (!error) return

  const mem = memoryPending.get(id)
  if (mem) {
    mem.status = 'completed'
    mem.completed_at = new Date().toISOString()
  }
}

export async function failPixRelayPending (
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_pix_relay_pending')
    .update({ status: 'failed' })
    .eq('id', id)

  if (!error) return

  const mem = memoryPending.get(id)
  if (mem) mem.status = 'failed'
}
