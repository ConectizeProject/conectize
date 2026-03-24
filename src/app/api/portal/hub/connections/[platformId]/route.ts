import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ platformId: string }> }
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { platformId } = await params
  if (!platformId) {
    return NextResponse.json({ ok: false, error: 'platform_required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('hub_connections')
    .delete()
    .eq('platform_id', platformId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
