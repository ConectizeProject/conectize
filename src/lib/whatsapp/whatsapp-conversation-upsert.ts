import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

let hubConnectionColumnAvailable: boolean | null = null

function isMissingHubConnectionColumn (error: PostgrestError | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204') return true
  return String(error.message || '').includes('hub_connection_id')
}

function isUniqueViolation (error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === '23505' || String(error.message || '').includes('duplicate key')
}

/** Detecta se a migration multi-instância foi aplicada no Supabase. */
export async function whatsappSupportsHubConnectionId (
  supabase: SupabaseClient,
): Promise<boolean> {
  if (hubConnectionColumnAvailable !== null) return hubConnectionColumnAvailable
  const { error } = await supabase
    .from('whatsapp_conversations')
    .select('hub_connection_id')
    .limit(0)
  if (isMissingHubConnectionColumn(error)) {
    hubConnectionColumnAvailable = false
    return false
  }
  hubConnectionColumnAvailable = true
  return true
}

export type UpsertWhatsappConversationInput = {
  organizationId: string
  hubConnectionId?: string | null
  waFrom: string
  lastMessageAt: string
  needsStaffAttention?: boolean
  state?: Record<string, unknown>
}

/**
 * Upsert via select+update/insert.
 *
 * Os índices únicos de `whatsapp_conversations` são **parciais**
 * (`WHERE hub_connection_id IS NOT NULL` / `IS NULL`). O PostgREST `.upsert`
 * gera `ON CONFLICT (cols)` sem o predicado parcial → Postgres `42P10`.
 * Por isso não usamos `.upsert` aqui.
 */
async function upsertWhatsappConversationByLookup (
  supabase: SupabaseClient,
  input: UpsertWhatsappConversationInput,
  useHub: boolean,
  supportsHubColumn: boolean,
  raceRetry = false,
): Promise<{ ok: true; id: string } | { ok: false; error: PostgrestError }> {
  let lookup = supabase
    .from('whatsapp_conversations')
    .select('id, state')
    .eq('organization_id', input.organizationId)
    .eq('wa_from', input.waFrom)

  if (useHub) {
    lookup = lookup.eq('hub_connection_id', input.hubConnectionId as string)
  } else if (supportsHubColumn) {
    // Índice legado: unique (organization_id, wa_from) WHERE hub_connection_id IS NULL
    lookup = lookup.is('hub_connection_id', null)
  }

  const { data: existing, error: findErr } = await lookup.maybeSingle()
  if (findErr) return { ok: false, error: findErr }

  const patch: Record<string, unknown> = {
    last_message_at: input.lastMessageAt,
  }
  if (input.needsStaffAttention !== undefined) {
    patch.needs_staff_attention = input.needsStaffAttention
  }
  if (input.state) {
    const prev = (existing?.state as Record<string, unknown> | null) || {}
    patch.state = { ...prev, ...input.state }
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update(patch)
      .eq('id', existing.id)
    if (error) return { ok: false, error }
    return { ok: true, id: existing.id as string }
  }

  const insertRow: Record<string, unknown> = {
    organization_id: input.organizationId,
    wa_from: input.waFrom,
    last_message_at: input.lastMessageAt,
    ...patch,
  }
  if (useHub) {
    insertRow.hub_connection_id = input.hubConnectionId
  } else if (supportsHubColumn) {
    insertRow.hub_connection_id = null
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('whatsapp_conversations')
    .insert(insertRow)
    .select('id')
    .single()

  if (!insertErr && inserted?.id) {
    return { ok: true, id: inserted.id as string }
  }

  // Corrida: outra request inseriu entre o select e o insert.
  if (isUniqueViolation(insertErr) && !raceRetry) {
    return upsertWhatsappConversationByLookup(
      supabase,
      input,
      useHub,
      supportsHubColumn,
      true,
    )
  }

  if (insertErr) return { ok: false, error: insertErr }
  return {
    ok: false,
    error: {
      name: 'PostgrestError',
      message: 'insert_failed',
      details: '',
      hint: '',
      code: 'PGRST116',
    } as PostgrestError,
  }
}

export async function upsertWhatsappConversation (
  supabase: SupabaseClient,
  input: UpsertWhatsappConversationInput,
): Promise<{ ok: true; id: string } | { ok: false; error: PostgrestError }> {
  const supportsHub = await whatsappSupportsHubConnectionId(supabase)
  const useHub = supportsHub && Boolean(input.hubConnectionId)
  return upsertWhatsappConversationByLookup(
    supabase,
    input,
    useHub,
    supportsHub,
  )
}
