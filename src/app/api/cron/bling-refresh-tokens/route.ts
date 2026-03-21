import { NextResponse } from 'next/server'
import { runBlingTokenRefreshForAllConnections } from '@/lib/integrations/bling/scheduled-token-refresh'

function verifyCronSecret (request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  const bearer =
    auth && auth.length > 7 && auth.slice(0, 7).toLowerCase() === 'bearer '
      ? auth.slice(7).trim()
      : null
  const header = request.headers.get('x-cron-secret')
  return bearer === secret || header === secret
}

function handle () {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET não configurado' },
      { status: 503 }
    )
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY necessário para renovar tokens em background' },
      { status: 503 }
    )
  }
  return null
}

export async function GET (request: Request) {
  const cfg = handle()
  if (cfg) return cfg
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await runBlingTokenRefreshForAllConnections()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST (request: Request) {
  return GET(request)
}
