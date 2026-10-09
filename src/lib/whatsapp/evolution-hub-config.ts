import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveHubSecretsReader } from '@/lib/supabase/hub-secrets'

export const WHATSAPP_EVOLUTION_PLATFORM_ID = 'whatsapp_evolution'

export type WhatsappEvolutionHubMetadata = {
  instance_name?: string
  /** Rótulo no portal (opcional) */
  label?: string
  preferred_for_messages?: boolean
  api_base_url_override?: string
  automation_enabled?: boolean
  /** Mensagens de OS (abertura / pronta para retirada), independente da IA. */
  auto_messages_enabled?: boolean
  auto_message_templates?: {
    os_opened?: string
    os_ready_for_pickup?: string
  }
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
  const orgId = String(organizationId || '').trim()
  if (!orgId) return []
  const { data: rows } = await resolveHubSecretsReader(supabase)
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  return (rows || [])
    .filter((r) => String((r.metadata as WhatsappEvolutionHubMetadata)?.instance_name || '').trim())
    .map(rowToEvolutionHub)
}

export async function findEvolutionHubByInstance (
  supabase: SupabaseClient,
  instanceName: string,
  organizationId?: string,
): Promise<EvolutionHubRow | null> {
  const name = instanceName.trim().toLowerCase()
  if (!name) return null
  const orgId = String(organizationId || '').trim()
  const db = orgId ? resolveHubSecretsReader(supabase) : supabase
  let query = db
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
  if (orgId) query = query.eq('organization_id', orgId)
  const { data: rows } = await query
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
  const orgId = String(organizationId || '').trim()
  const db = orgId ? resolveHubSecretsReader(supabase) : supabase
  let q = db
    .from('hub_connections')
    .select('id, access_token, metadata, organization_id')
    .eq('platform_id', WHATSAPP_EVOLUTION_PLATFORM_ID)
    .eq('id', connectionId)
  if (orgId) q = q.eq('organization_id', orgId)
  const { data: r } = await q.maybeSingle()
  if (!r?.organization_id) return null
  return rowToEvolutionHub(r as Parameters<typeof rowToEvolutionHub>[0])
}

export function evolutionHubDisplayLabel (meta: WhatsappEvolutionHubMetadata): string {
  const label = String(meta.label || '').trim()
  if (label) return label
  return String(meta.instance_name || '').trim() || 'Evolution'
}

function isPrivateOrLocalHostname (hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '0.0.0.0' || host === '::') return true
  if (
    host.endsWith('.local')
    || host.endsWith('.internal')
    || host.endsWith('.lan')
    || host.endsWith('.home')
  ) {
    return true
  }
  if (host === 'metadata.google.internal') return true

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number)
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return true
  }

  if (host.includes(':')) return true
  return false
}

/** Override de URL da Evolution: só https em host público, sem credencial. */
export function isAllowedEvolutionApiBaseUrl (raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  if (isPrivateOrLocalHostname(parsed.hostname)) return false
  return true
}

export function resolveEvolutionApiBaseUrl (
  meta: WhatsappEvolutionHubMetadata,
): string {
  const o = meta.api_base_url_override?.trim()
  if (o) {
    const cleaned = o.replace(/\/$/, '')
    return isAllowedEvolutionApiBaseUrl(cleaned) ? cleaned : ''
  }
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

export function resolveEvolutionApiKey (
  accessToken: string | null,
  meta?: WhatsappEvolutionHubMetadata | null,
): string | null {
  const t = accessToken?.trim()
  if (t && isLikelyEvolutionApiKey(t)) return t
  if (meta?.api_base_url_override?.trim()) return null
  const e = process.env.WHATSAPP_EVOLUTION_API_KEY?.trim()
  return e || null
}
