import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getInboundNfeDocument } from '@/lib/fiscal/inbound-nfe'

type Params = { params: Promise<{ id: string }> }

export async function GET (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await getInboundNfeDocument(auth, String(id || ''))
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }
  return NextResponse.json({ ok: true, document: result.document })
}
