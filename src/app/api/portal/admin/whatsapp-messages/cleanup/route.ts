import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  isWhatsappMessagePurgeScope,
  previewWhatsappMessagesDbCleanup,
  purgeWhatsappMessagesFromDatabase,
  whatsappMessagePurgeCutoffIso,
  type WhatsappMessagePurgeScope,
} from '@/lib/whatsapp/whatsapp-messages-db-cleanup'

function readScope (value: unknown): WhatsappMessagePurgeScope | null {
  const scope = String(value || '').trim()
  if (!isWhatsappMessagePurgeScope(scope)) return null
  return scope
}

export async function GET (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const scope = readScope(new URL(request.url).searchParams.get('scope') || '90d')
  if (!scope) {
    return NextResponse.json({ ok: false, error: 'invalid_scope' }, { status: 400 })
  }

  try {
    const preview = await previewWhatsappMessagesDbCleanup(
      auth.supabase,
      auth.organizationId,
      scope,
    )
    return NextResponse.json({ ok: true, ...preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'preview_failed'
    const timedOut = message.toLowerCase().includes('statement timeout') || message.includes('57014')
    if (timedOut) {
      console.warn('[whatsapp-messages-cleanup GET] timeout', message)
      return NextResponse.json({
        ok: true,
        scope,
        cutoffAt: whatsappMessagePurgeCutoffIso(scope),
        messageCount: 0,
        countComplete: false,
        conversationCount: 0,
        tableBytes: null,
        previewTimedOut: true,
      })
    }
    console.error('[whatsapp-messages-cleanup GET]', message)
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
  } | null

  const scope = readScope(body?.scope)
  if (!scope) {
    return NextResponse.json({ ok: false, error: 'invalid_scope' }, { status: 400 })
  }

  const cutoffAt = scope === 'all' ? null : whatsappMessagePurgeCutoffIso(scope)

  try {
    const result = await purgeWhatsappMessagesFromDatabase(
      auth.supabase,
      auth.organizationId,
      cutoffAt,
    )
    return NextResponse.json({ ok: true, cutoffAt, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cleanup_failed'
    console.error('[whatsapp-messages-cleanup POST]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
