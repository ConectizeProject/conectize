import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { resolveCestLookup } from '@/lib/fiscal/cest-lookup'
import { fiscalCestOrNull, fiscalNcmOrNull } from '@/lib/fiscal/ncm'

export const dynamic = 'force-dynamic'

export async function GET (request: Request) {
  const { user } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const ncm = fiscalNcmOrNull(url.searchParams.get('ncm'))
  if (!ncm) {
    return NextResponse.json({ ok: true, status: 'unknown', suggestions: [] })
  }

  const lookup = await resolveCestLookup(ncm, fiscalCestOrNull(url.searchParams.get('cest')))
  return NextResponse.json({
    ok: true,
    status: lookup.status,
    suggestions: lookup.suggestions,
  })
}
