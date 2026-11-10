import { GerarDanfeUseCase } from '@brasil-fiscal/nfe'
import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

type Params = { params: Promise<{ id: string }> }

export async function GET (request: Request, { params }: Params) {
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
      error: 'danfe_unavailable',
      message: 'O DANFE estará disponível depois da importação ou autorização da NF-e.',
    }, { status: 409 })
  }

  try {
    const pdf = await new GerarDanfeUseCase().execute(xml)
    const name = data.access_key
      ? `danfe-${String(data.access_key)}.pdf`
      : `danfe-entrada-${Number(data.series) || 0}-${Number(data.number) || 0}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (danfeError) {
    console.error('[inbound-nfe] danfe generation failed', danfeError)
    return NextResponse.json({ ok: false, error: 'danfe_error' }, { status: 500 })
  }
}
