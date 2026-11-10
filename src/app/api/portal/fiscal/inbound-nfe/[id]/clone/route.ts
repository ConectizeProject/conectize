import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { cloneInboundNfeDocument } from '@/lib/fiscal/inbound-nfe'

type Params = { params: Promise<{ id: string }> }

export async function POST (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await cloneInboundNfeDocument(auth, String(id || ''))
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Não foi possível clonar a entrada.',
    }, { status: result.error === 'not_found' ? 404 : 400 })
  }

  return NextResponse.json({ ok: true, document: result.document })
}
