import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  isWebhookPurgePlatform,
  isWebhookRecordPurgeScope,
  previewWebhookRecordsCleanup,
  purgeWebhookRecords,
  webhookRecordPurgeCutoffIso,
  type WebhookPurgePlatform,
  type WebhookRecordPurgeScope,
} from '@/lib/integrations/webhook-records-cleanup'

function readScope (value: unknown): WebhookRecordPurgeScope | null {
  const scope = String(value || '').trim()
  if (!isWebhookRecordPurgeScope(scope)) return null
  return scope
}

function readPlatform (value: unknown): WebhookPurgePlatform | null {
  const platform = String(value || '').trim() || 'all'
  if (!isWebhookPurgePlatform(platform)) return null
  return platform
}

function isStatementTimeout (message: string): boolean {
  return message.toLowerCase().includes('statement timeout') || message.includes('57014')
}

async function cleanupClient (sessionClient: Parameters<typeof previewWebhookRecordsCleanup>[0]) {
  try {
    return createSupabaseServiceClient()
  } catch (err) {
    console.warn('[webhooks-cleanup] service client unavailable, using session client', err)
    return sessionClient
  }
}

export async function GET (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const params = new URL(request.url).searchParams
  const scope = readScope(params.get('scope') || '90d')
  const platform = readPlatform(params.get('platform'))
  if (!scope || !platform) {
    return NextResponse.json({ ok: false, error: 'invalid_filter' }, { status: 400 })
  }

  try {
    const supabase = await cleanupClient(auth.supabase)
    const preview = await previewWebhookRecordsCleanup(
      supabase,
      auth.organizationId,
      scope,
      platform,
    )
    return NextResponse.json({ ok: true, ...preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'preview_failed'
    if (isStatementTimeout(message)) {
      console.warn('[webhooks-cleanup GET] timeout', message)
      return NextResponse.json({
        ok: true,
        scope,
        platform,
        cutoffAt: webhookRecordPurgeCutoffIso(scope),
        recordCount: 0,
        countComplete: false,
        tableBytes: null,
        previewTimedOut: true,
      })
    }
    console.error('[webhooks-cleanup GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    scope?: unknown
    platform?: unknown
  } | null

  const scope = readScope(body?.scope)
  const platform = readPlatform(body?.platform)
  if (!scope || !platform) {
    return NextResponse.json({ ok: false, error: 'invalid_filter' }, { status: 400 })
  }

  const cutoffAt = scope === 'all'
    ? null
    : webhookRecordPurgeCutoffIso(scope)

  try {
    const supabase = await cleanupClient(auth.supabase)
    const result = await purgeWebhookRecords(
      supabase,
      auth.organizationId,
      cutoffAt,
      platform,
    )
    return NextResponse.json({ ok: true, cutoffAt, deleted: result.deleted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cleanup_failed'
    console.error('[webhooks-cleanup POST]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
