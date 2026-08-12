import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { listStoredWhatsappImages } from '@/lib/whatsapp/whatsapp-media-admin'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const images = await listStoredWhatsappImages(auth.supabase, auth.organizationId)
    return NextResponse.json({ ok: true, images })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed'
    console.error('[whatsapp-media GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
