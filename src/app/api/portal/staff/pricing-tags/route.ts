import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  PARSE_INVALID,
  parseMarginBps,
  parseMinCents,
} from '@/lib/pricing/pricing-api-parse'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('pricing_tags')
    .select('id, name, margin_bps, min_suggested_sale_cents, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) {
    console.error('[staff/pricing-tags GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pricingTags: data || [] })
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const name = String(body.name || '').trim()
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
  }

  const marginBps = parseMarginBps(body.marginBps)
  if (marginBps === PARSE_INVALID) {
    return NextResponse.json({ ok: false, error: 'marginBps_invalid' }, { status: 400 })
  }

  const minSuggestedSaleCents = parseMinCents(body.minSuggestedSaleCents)
  if (minSuggestedSaleCents === PARSE_INVALID) {
    return NextResponse.json({ ok: false, error: 'minSuggestedSaleCents_invalid' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    name,
    organization_id: auth.organizationId,
  }
  if (marginBps !== undefined) insert.margin_bps = marginBps
  if (minSuggestedSaleCents !== undefined) insert.min_suggested_sale_cents = minSuggestedSaleCents

  const { data, error } = await auth.supabase
    .from('pricing_tags')
    .insert(insert)
    .select('id, name, margin_bps, min_suggested_sale_cents, created_at, updated_at')
    .single()

  if (error) {
    console.error('[staff/pricing-tags POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pricingTag: data })
}
