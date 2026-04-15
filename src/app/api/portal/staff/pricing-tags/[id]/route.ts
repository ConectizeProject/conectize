import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  PARSE_INVALID,
  parseMarginBps,
  parseMinCents,
} from '@/lib/pricing/pricing-api-parse'

type Params = Promise<{ id: string }>

export async function PATCH (
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = String(body.name || '').trim()
    if (!name) {
      return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
    }
    patch.name = name
  }

  if (Object.prototype.hasOwnProperty.call(body, 'marginBps')) {
    const marginBps = parseMarginBps(body.marginBps)
    if (marginBps === PARSE_INVALID) {
      return NextResponse.json({ ok: false, error: 'marginBps_invalid' }, { status: 400 })
    }
    patch.margin_bps = marginBps
  }

  if (Object.prototype.hasOwnProperty.call(body, 'minSuggestedSaleCents')) {
    const minSuggestedSaleCents = parseMinCents(body.minSuggestedSaleCents)
    if (minSuggestedSaleCents === PARSE_INVALID) {
      return NextResponse.json({ ok: false, error: 'minSuggestedSaleCents_invalid' }, { status: 400 })
    }
    patch.min_suggested_sale_cents = minSuggestedSaleCents
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  patch.updated_at = new Date().toISOString()

  const { data, error } = await auth.supabase
    .from('pricing_tags')
    .update(patch)
    .eq('id', id)
    .select('id, name, margin_bps, min_suggested_sale_cents, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[staff/pricing-tags PATCH]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, pricingTag: data })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { error } = await auth.supabase.from('pricing_tags').delete().eq('id', id)
  if (error) {
    console.error('[staff/pricing-tags DELETE]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
