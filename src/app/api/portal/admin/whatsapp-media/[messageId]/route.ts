import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { deleteWhatsappImageMedia } from '@/lib/whatsapp/whatsapp-media-admin'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function DELETE (
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { messageId: rawMessageId } = await params
  const messageId = parseOptionalUuid(rawMessageId)
  if (!messageId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  try {
    await deleteWhatsappImageMedia(auth.supabase, auth.organizationId, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed'
    if (message === 'not_found' || message === 'not_image') {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    console.error('[whatsapp-media DELETE]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
