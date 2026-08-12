import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getStorageUsageSummary } from '@/lib/admin/storage-usage'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    let supabase = auth.supabase
    try {
      supabase = createSupabaseServiceClient()
    } catch (svcErr) {
      console.warn('[storage-usage GET] service client unavailable, using session client', svcErr)
    }

    const usage = await getStorageUsageSummary(supabase, auth.organizationId)
    return NextResponse.json({ ok: true, ...usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'usage_failed'
    console.error('[storage-usage GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
