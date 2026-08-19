import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { listFiscalDocuments } from '@/lib/fiscal/documents'

export const runtime = 'nodejs'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const modelParam = request.nextUrl.searchParams.get('model')
  const model = modelParam === '55' ? '55' : '65'
  const status = String(request.nextUrl.searchParams.get('status') || '').trim()
  const from = String(request.nextUrl.searchParams.get('from') || '').trim()
  const to = String(request.nextUrl.searchParams.get('to') || '').trim()

  const result = await listFiscalDocuments(auth, {
    model,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, documents: result.documents })
}
