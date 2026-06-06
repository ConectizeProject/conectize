import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { cleanupExpiredWhatsappMedia } from '@/lib/whatsapp/whatsapp-media-cleanup'

function getCronSecret (): string {
  return String(process.env.CRON_SECRET || '').trim()
}

async function verifyCronSecret (request: Request): Promise<boolean> {
  const secret = getCronSecret()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  const bearer =
    auth && auth.length > 7 && auth.slice(0, 7).toLowerCase() === 'bearer '
      ? auth.slice(7).trim()
      : null
  const header = request.headers.get('x-cron-secret')?.trim() ?? null
  if (bearer === secret || header === secret) return true

  if (request.method === 'POST') {
    try {
      const raw = await request.clone().text()
      const trimmed = raw?.trim()
      if (!trimmed) return false
      const parsed = JSON.parse(trimmed) as { cronSecret?: unknown }
      if (typeof parsed.cronSecret === 'string' && parsed.cronSecret.trim() === secret) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

function handleConfig () {
  if (!getCronSecret()) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET não configurado' },
      { status: 503 },
    )
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY necessário' },
      { status: 503 },
    )
  }
  return null
}

async function runCleanup () {
  const supabase = createSupabaseServiceClient()
  const totals = { scanned: 0, deleted: 0, errors: 0 }
  for (let pass = 0; pass < 20; pass++) {
    const stats = await cleanupExpiredWhatsappMedia(supabase)
    totals.scanned += stats.scanned
    totals.deleted += stats.deleted
    totals.errors += stats.errors
    if (stats.scanned === 0) break
  }
  return totals
}

export async function GET (request: Request) {
  const cfg = handleConfig()
  if (cfg) return cfg
  if (!(await verifyCronSecret(request))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const stats = await runCleanup()
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST (request: Request) {
  return GET(request)
}
