import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

let hubConnectionColumnAvailable: boolean | null = null

function isMissingHubConnectionColumn (error: PostgrestError | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204') return true
  return String(error.message || '').includes('hub_connection_id')
}

function needsManualUpsert (error: PostgrestError | null): boolean {
  if (!error) return false
  if (error.code === '42P10') return true
  return String(error.message || '').includes('ON CONFLICT')
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

async function manualUpsertWhatsappConversation (
  supabase: SupabaseClient,
  input: UpsertWhatsappConversationInput,
  useHub: boolean,
): Promise<{ ok: true; id: string } | { ok: false; error: PostgrestError }> {
  let lookup = supabase
    .from('whatsapp_conversations')
    .select('id, state')
    .eq('organization_id', input.organizationId)
    .eq('wa_from', input.waFrom)

  if (useHub) {
    lookup = lookup.eq('hub_connection_id', input.hubConnectionId as string)
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
  if (useHub) insertRow.hub_connection_id = input.hubConnectionId

  const { data: inserted, error: insertErr } = await supabase
    .from('whatsapp_conversations')
    .insert(insertRow)
    .select('id')
    .single()

  if (insertErr) return { ok: false, error: insertErr }
  return { ok: true, id: inserted.id as string }
}

export async function upsertWhatsappConversation (
  supabase: SupabaseClient,
  input: UpsertWhatsappConversationInput,
): Promise<{ ok: true; id: string } | { ok: false; error: PostgrestError }> {
  const supportsHub = await whatsappSupportsHubConnectionId(supabase)
  const useHub = supportsHub && Boolean(input.hubConnectionId)

  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    wa_from: input.waFrom,
    last_message_at: input.lastMessageAt,
  }
  if (input.needsStaffAttention !== undefined) {
    row.needs_staff_attention = input.needsStaffAttention
  }
  if (input.state) row.state = input.state
  if (useHub) row.hub_connection_id = input.hubConnectionId

  const onConflict = useHub
    ? 'organization_id,hub_connection_id,wa_from'
    : 'organization_id,wa_from'

  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .upsert(row, { onConflict })
    .select('id')
    .maybeSingle()

  if (!error && data?.id) return { ok: true, id: data.id as string }

  if (
    error &&
    !isMissingHubConnectionColumn(error) &&
    !needsManualUpsert(error)
  ) {
    return { ok: false, error }
  }

  const manual = await manualUpsertWhatsappConversation(supabase, input, useHub)
  return manual
}
