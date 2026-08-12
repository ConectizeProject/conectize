import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  previewOldServiceOrderPhotosCleanup,
  runOldServiceOrderPhotosCleanup,
} from '@/lib/orders/service-order-photos-cleanup'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const preview = await previewOldServiceOrderPhotosCleanup(
      auth.supabase,
      auth.organizationId,
    )
    return NextResponse.json({ ok: true, ...preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'preview_failed'
    console.error('[service-order-photos-cleanup GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const result = await runOldServiceOrderPhotosCleanup(
      auth.supabase,
      auth.organizationId,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cleanup_failed'
    console.error('[service-order-photos-cleanup POST]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
