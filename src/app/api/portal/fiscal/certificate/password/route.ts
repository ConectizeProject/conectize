import { NextResponse } from 'next/server'
import { requireFiscalAdmin } from '@/lib/fiscal/portal-access'
import { getFiscalCertificateSecret } from '@/lib/fiscal/profile'

export const runtime = 'nodejs'

export async function POST () {
  const auth = await requireFiscalAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await getFiscalCertificateSecret(auth.organizationId)
  if (result.ok === false) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json(
    { ok: true, password: result.certificate.password },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
