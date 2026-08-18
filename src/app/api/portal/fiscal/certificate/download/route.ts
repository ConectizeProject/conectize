import { NextResponse } from 'next/server'
import { requireFiscalAdmin } from '@/lib/fiscal/portal-access'
import { getFiscalCertificateSecret } from '@/lib/fiscal/profile'

export const runtime = 'nodejs'

function safeCertificateFilename (fingerprint: string) {
  const suffix = fingerprint.slice(0, 12) || 'a1'
  return `certificado-a1-${suffix}.pfx`
}

export async function GET () {
  const auth = await requireFiscalAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await getFiscalCertificateSecret(auth.organizationId)
  if (result.ok === false) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  const filename = safeCertificateFilename(result.certificate.fingerprintSha256)
  return new Response(new Uint8Array(result.certificate.pfxBuffer), {
    headers: {
      'Content-Type': 'application/x-pkcs12',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
