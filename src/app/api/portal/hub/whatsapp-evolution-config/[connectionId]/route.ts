import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { WHATSAPP_EVOLUTION_PLATFORM_ID } from '@/lib/whatsapp/evolution-hub-config'

const PLATFORM = WHATSAPP_EVOLUTION_PLATFORM_ID

export async function DELETE (
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { connectionId } = await params
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'connection_id_required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('hub_connections')
    .delete()
    .eq('id', connectionId)
    .eq('platform_id', PLATFORM)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
