import { NextResponse } from 'next/server'
import { requireRealAdmin } from '@/lib/auth/portal-api'
import { processBlingWebhook } from '@/lib/integrations/bling/webhook-service'
import { processMeliWebhook } from '@/lib/integrations/mercado-livre/webhook-service'

function normalizePlatform(value: unknown): 'bling' | 'mercado_livre' {
  return String(value || '').trim() === 'mercado_livre'
    ? 'mercado_livre'
    : 'bling'
}

export async function POST(request: Request) {
  const auth = await requireRealAdmin()
  if (auth.ok === false) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    platform?: unknown
  } | null
  const platform = normalizePlatform(body?.platform)

  const { data: rows, error } = await auth.supabase
    .from('integration_webhooks')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .eq('platform_id', platform)
    .eq('status', 'error')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const ids = (rows ?? [])
    .map((r) => String((r as { id?: string }).id || '').trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      processed: 0,
      failed: 0,
      message: 'Nenhum webhook com erro para reprocessar.',
    })
  }

  let processed = 0
  let failed = 0
  const errors: string[] = []

  for (const id of ids) {
    const res =
      platform === 'mercado_livre'
        ? await processMeliWebhook(id)
        : await processBlingWebhook(id)
    switch (res.ok) {
      case true:
        processed += 1
        break
      case false: {
        failed += 1
        const msg = String(res.error_message || '').trim()
        if (msg) errors.push(msg)
        break
      }
      default:
        break
    }
  }

  return NextResponse.json({
    ok: true,
    total: ids.length,
    processed,
    failed,
    error_message: errors[0] || null,
  })
}
