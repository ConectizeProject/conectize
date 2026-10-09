import type { SupabaseClient } from '@supabase/supabase-js'

const DAY_MS = 24 * 60 * 60 * 1000
const PREVIEW_CAP = 200

const KNOWN_PLATFORMS = ['bling', 'mercado_livre'] as const
const OTHER_PLATFORM = '*other'

export const WEBHOOK_RECORD_PURGE_SCOPES = [
  { id: '30d', label: 'Registros com mais de 30 dias', days: 30 },
  { id: '90d', label: 'Registros com mais de 90 dias', days: 90 },
  { id: '180d', label: 'Registros com mais de 6 meses', days: 180 },
  { id: '365d', label: 'Registros com mais de 1 ano', days: 365 },
  { id: 'all', label: 'Todos os registros', days: null },
] as const

export const WEBHOOK_PURGE_PLATFORMS = [
  { id: 'all', label: 'Todas as plataformas' },
  { id: 'bling', label: 'Bling' },
  { id: 'mercado_livre', label: 'Mercado Livre' },
] as const

export type WebhookRecordPurgeScope = (typeof WEBHOOK_RECORD_PURGE_SCOPES)[number]['id']
export type WebhookPurgePlatform = (typeof WEBHOOK_PURGE_PLATFORMS)[number]['id']

export type WebhookRecordsPreview = {
  scope: WebhookRecordPurgeScope
  platform: WebhookPurgePlatform
  cutoffAt: string | null
  recordCount: number
  countComplete: boolean
  tableBytes: number | null
}

export type WebhookRecordsPurgeResult = {
  deleted: number
}

type DbError = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export function isWebhookRecordPurgeScope (value: string): value is WebhookRecordPurgeScope {
  return WEBHOOK_RECORD_PURGE_SCOPES.some((scope) => scope.id === value)
}

export function isWebhookPurgePlatform (value: string): value is WebhookPurgePlatform {
  return WEBHOOK_PURGE_PLATFORMS.some((platform) => platform.id === value)
}

export function webhookRecordPurgeCutoffIso (
  scope: WebhookRecordPurgeScope,
  now = new Date(),
): string | null {
  const days = WEBHOOK_RECORD_PURGE_SCOPES.find((item) => item.id === scope)?.days
  if (days == null) return null
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}

/** Limite superior da exclusão "todos": não aceita data no futuro. */
export function resolveWebhookPurgeStartedAt (startedAt: string | null | undefined, now = new Date()): string {
  const parsed = startedAt ? new Date(startedAt) : now
  if (Number.isNaN(parsed.getTime())) return now.toISOString()
  if (parsed.getTime() > now.getTime() + 60_000) return now.toISOString()
  return parsed.toISOString()
}

export function webhookPurgePlatformQueue (platform: WebhookPurgePlatform): string[] {
  if (platform === 'all') return [...KNOWN_PLATFORMS, OTHER_PLATFORM]
  return [platform]
}

function throwDb (error: DbError): never {
  const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' ')
  throw new Error(message || 'db_error')
}

function isMissingBytesRpc (message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('admin_integration_webhooks_table_bytes')
    && (
      normalized.includes('could not find')
      || normalized.includes('schema cache')
      || normalized.includes('does not exist')
    )
}

async function listWebhookIds (
  supabase: SupabaseClient,
  organizationId: string,
  platformKey: string,
  cutoffAt: string | null,
  limit: number,
): Promise<string[]> {
  let query = supabase
    .from('integration_webhooks')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(limit)

  if (platformKey === OTHER_PLATFORM) {
    query = query.not('platform_id', 'in', '(bling,mercado_livre)')
  } else {
    query = query.eq('platform_id', platformKey).order('created_at', { ascending: true })
  }

  if (cutoffAt) query = query.lte('created_at', cutoffAt)

  const { data, error } = await query
  if (error) throwDb(error)
  return (data || []).map((row) => String(row.id || '')).filter(Boolean)
}

function isMissingPurgeRpc (message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('admin_purge_integration_webhooks')
    && (
      normalized.includes('could not find')
      || normalized.includes('schema cache')
      || normalized.includes('does not exist')
    )
}

async function deleteWebhooksWhere (
  supabase: SupabaseClient,
  organizationId: string,
  cutoffAt: string | null,
  platform: WebhookPurgePlatform,
): Promise<number> {
  let query = supabase
    .from('integration_webhooks')
    .delete({ count: 'exact' })
    .eq('organization_id', organizationId)

  if (platform !== 'all') query = query.eq('platform_id', platform)
  if (cutoffAt) query = query.lte('created_at', cutoffAt)

  const { error, count } = await query
  if (error) throwDb(error)
  return count ?? 0
}

async function loadTableBytes (supabase: SupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc('admin_integration_webhooks_table_bytes')
  if (error) {
    if (!isMissingBytesRpc(error.message)) {
      console.warn('[webhook-records-cleanup] table bytes', error.message)
    }
    return null
  }
  if (typeof data === 'number' && Number.isFinite(data)) return data
  if (typeof data === 'string') {
    const parsed = Number(data)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export async function previewWebhookRecordsCleanup (
  supabase: SupabaseClient,
  organizationId: string,
  scope: WebhookRecordPurgeScope,
  platform: WebhookPurgePlatform,
  now = new Date(),
): Promise<WebhookRecordsPreview> {
  const cutoffAt = webhookRecordPurgeCutoffIso(scope, now)
  const tableBytes = await loadTableBytes(supabase)
  const queue = webhookPurgePlatformQueue(platform)

  let recordCount = 0
  let countComplete = true

  for (const platformKey of queue) {
    const ids = await listWebhookIds(
      supabase,
      organizationId,
      platformKey,
      cutoffAt,
      PREVIEW_CAP,
    )
    recordCount += ids.length
    if (ids.length >= PREVIEW_CAP) {
      countComplete = false
      break
    }
  }

  return {
    scope,
    platform,
    cutoffAt,
    recordCount,
    countComplete,
    tableBytes,
  }
}

export async function purgeWebhookRecords (
  supabase: SupabaseClient,
  organizationId: string,
  cutoffAt: string | null,
  platform: WebhookPurgePlatform,
): Promise<WebhookRecordsPurgeResult> {
  const { data, error } = await supabase.rpc('admin_purge_integration_webhooks', {
    p_organization_id: organizationId,
    p_before: cutoffAt,
    p_platform: platform === 'all' ? null : platform,
  })

  if (!error) {
    const deleted = typeof data === 'number'
      ? data
      : Number(data)
    return { deleted: Number.isFinite(deleted) ? deleted : 0 }
  }

  if (!isMissingPurgeRpc(error.message)) throwDb(error)
  return { deleted: await deleteWebhooksWhere(supabase, organizationId, cutoffAt, platform) }
}
