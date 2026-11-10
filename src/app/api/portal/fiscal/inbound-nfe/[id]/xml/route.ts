import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

type Params = { params: Promise<{ id: string }> }

export async function GET (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { data, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .select('series, number, access_key, xml_content')
    .eq('organization_id', auth.organizationId)
    .eq('id', String(id || ''))
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const xml = String(data.xml_content || '').trim()
  if (!xml) {
    return NextResponse.json({
      ok: false,
      error: 'xml_unavailable',
      message: 'O XML estará disponível depois da importação ou autorização da NF-e.',
    }, { status: 409 })
  }

  const name = data.access_key
    ? `nfe-${String(data.access_key)}.xml`
    : `nfe-entrada-${Number(data.series) || 0}-${Number(data.number) || 0}.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
