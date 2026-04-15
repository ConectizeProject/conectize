import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  PARSE_INVALID,
  parseMarginBps,
  parseMinCents,
  parseUuid,
} from '@/lib/pricing/pricing-api-parse'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const retailerUserId = parseUuid(new URL(request.url).searchParams.get('retailerUserId'))

  let query = auth.supabase
    .from('pricing_tag_retailer_overrides')
    .select('id, pricing_tag_id, retailer_user_id, margin_bps, min_suggested_sale_cents, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (retailerUserId) {
    query = query.eq('retailer_user_id', retailerUserId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[staff/pricing-tag-overrides GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, overrides: data || [] })
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

  const pricingTagId = parseUuid(body.pricingTagId)
  const retailerUserId = parseUuid(body.retailerUserId)
  if (!pricingTagId || !retailerUserId) {
    return NextResponse.json({ ok: false, error: 'ids_invalid' }, { status: 400 })
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
    pricing_tag_id: pricingTagId,
    retailer_user_id: retailerUserId,
  }
  if (marginBps !== undefined) insert.margin_bps = marginBps
  if (minSuggestedSaleCents !== undefined) insert.min_suggested_sale_cents = minSuggestedSaleCents

  const { data, error } = await auth.supabase
    .from('pricing_tag_retailer_overrides')
    .upsert(insert, { onConflict: 'pricing_tag_id,retailer_user_id' })
    .select('id, pricing_tag_id, retailer_user_id, margin_bps, min_suggested_sale_cents, created_at, updated_at')
    .single()

  if (error) {
    console.error('[staff/pricing-tag-overrides POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, override: data })
}
