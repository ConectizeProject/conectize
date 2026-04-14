import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { processBlingWebhook } from '@/lib/integrations/bling/webhook-service'

export async function POST () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: rows, error } = await auth.supabase
    .from('integration_webhooks')
    .select('id')
    .eq('platform_id', 'bling')
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
    const res = await processBlingWebhook(id)
    if (res.ok) {
      processed += 1
    } else {
      failed += 1
      const msg = String(res.error_message || '').trim()
      if (msg) errors.push(msg)
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

