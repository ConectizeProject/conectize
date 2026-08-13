import { NextResponse } from 'next/server'
import { requireRealAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000

export async function POST (request: Request) {
  const auth = await requireRealAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { platform?: unknown } | null
  const platform = String(body?.platform ?? 'bling').trim() || 'bling'
  const cutoffIso = new Date(Date.now() - THREE_MONTHS_MS).toISOString()
  const supabase = createSupabaseServiceClient()

  const { error: deleteError, count: deletedCount } = await supabase
    .from('integration_webhooks')
    .delete({ count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .eq('platform_id', platform)
    .lt('created_at', cutoffIso)

  if (deleteError) {
    return NextResponse.json({ ok: false, error: 'db_error', message: deleteError.message }, { status: 500 })
  }

  const deleted = deletedCount ?? 0
  return NextResponse.json({
    ok: true,
    deleted,
    cutoff: cutoffIso,
    platform,
    message: deleted === 0 ? 'Nenhum webhook com mais de 3 meses para excluir.' : undefined,
  })
}
