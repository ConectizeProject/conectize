import { NextResponse } from 'next/server'
import { runSeminovosLojistasWhatsappBroadcast } from '@/lib/seminovos/scheduled-lojistas-whatsapp-broadcast'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

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

function isForceBroadcast (request: Request): boolean {
  const url = new URL(request.url)
  if (url.searchParams.get('force') === '1') return true
  const header = request.headers.get('x-cron-force')?.trim().toLowerCase()
  return header === '1' || header === 'true' || header === 'yes'
}

async function runBroadcast (request: Request) {
  const supabase = createSupabaseServiceClient()
  return runSeminovosLojistasWhatsappBroadcast(supabase, {
    force: isForceBroadcast(request),
  })
}

export async function GET (request: Request) {
  const cfg = handleConfig()
  if (cfg) return cfg
  if (!(await verifyCronSecret(request))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runBroadcast(request)
    if ('skipped' in result && result.skipped) {
      return NextResponse.json(result)
    }
    if (result.ok === false) {
      const status =
        result.error === 'whatsapp_not_configured' ||
        result.error === 'evolution_required_for_group'
          ? 503
          : 502
      return NextResponse.json(result, { status })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST (request: Request) {
  return GET(request)
}
