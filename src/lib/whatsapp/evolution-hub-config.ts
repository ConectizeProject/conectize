import type { SupabaseClient } from '@supabase/supabase-js'

export const WHATSAPP_EVOLUTION_PLATFORM_ID = 'whatsapp_evolution'

export type WhatsappEvolutionHubMetadata = {
  instance_name?: string
  /** Rótulo no portal (opcional) */
  label?: string
  preferred_for_messages?: boolean
  api_base_url_override?: string
  automation_enabled?: boolean
}

export type EvolutionHubRow = {
  id: string
  access_token: string | null
  metadata: WhatsappEvolutionHubMetadata
  organization_id: string
}

function rowToEvolutionHub (r: {
  id: string
  access_token: string | null
  metadata: unknown
  organization_id: string
}): EvolutionHubRow {
  return {
    id: r.id,
    access_token: r.access_token,
    metadata: (r.metadata as WhatsappEvolutionHubMetadata) || {},
    organization_id: String(r.organization_id),
  }
}

export async function listEvolutionHubsForOrganization (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<EvolutionHubRow[]> {
  const { data: rows } = await supabase
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  return (rows || [])
    .filter((r) => String((r.metadata as WhatsappEvolutionHubMetadata)?.instance_name || '').trim())
    .map(rowToEvolutionHub)
}

export async function findEvolutionHubByInstance (
  supabase: SupabaseClient,
  instanceName: string,
): Promise<EvolutionHubRow | null> {
  const name = instanceName.trim().toLowerCase()
  if (!name) return null
  const { data: rows } = await supabase
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
  const list = rows || []
  for (const r of list) {
    const meta = (r.metadata as WhatsappEvolutionHubMetadata) || {}
    if (String(meta.instance_name || '').trim().toLowerCase() !== name) continue
    if (!r.organization_id) continue
    return rowToEvolutionHub(r as Parameters<typeof rowToEvolutionHub>[0])
  }
  return null
}

export async function findEvolutionHubByConnectionId (
  supabase: SupabaseClient,
  connectionId: string,
  organizationId?: string,
): Promise<EvolutionHubRow | null> {
  let q = supabase
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .eq('id', connectionId)
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data: r } = await q.maybeSingle()
  if (!r?.organization_id) return null
  return rowToEvolutionHub(r as Parameters<typeof rowToEvolutionHub>[0])
}

export function evolutionHubDisplayLabel (meta: WhatsappEvolutionHubMetadata): string {
  const label = String(meta.label || '').trim()
  if (label) return label
  return String(meta.instance_name || '').trim() || 'Evolution'
}

export function resolveEvolutionApiBaseUrl (
  meta: WhatsappEvolutionHubMetadata,
): string {
  const o = meta.api_base_url_override?.trim()
  if (o) return o.replace(/\/$/, '')
  return (process.env.WHATSAPP_EVOLUTION_API_URL || '').trim().replace(/\/$/, '')
}

/** Chave Evolution costuma ser string curta (ex.: hex 32–128 chars), sem espaços/markdown. */
export function isLikelyEvolutionApiKey (token: string): boolean {
  const t = token.trim()
  if (!t || t.length < 8 || t.length > 256) return false
  if (t.startsWith('--') || t.startsWith('{') || t.startsWith('[')) return false
  if (/\s/.test(t)) return false
  return true
}

export function resolveEvolutionApiKey (accessToken: string | null): string | null {
  const t = accessToken?.trim()
  if (t && isLikelyEvolutionApiKey(t)) return t
  const e = process.env.WHATSAPP_EVOLUTION_API_KEY?.trim()
  return e || null
}
