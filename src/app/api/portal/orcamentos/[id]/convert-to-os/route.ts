import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import { parseQuoteItemsRaw } from '@/lib/quotes/quote-items'
import { canConvertQuoteStatus } from '@/lib/quotes/quote-status'

export async function POST (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const quoteId = parseOptionalUuid(rawId)
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: quote, error: fetchError } = await auth.supabase
    .from('quotes')
    .select(
      'id, organization_id, customer_id, title, status, items, items_total_cents, items_cost_total_cents, service_order_id',
    )
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (fetchError) {
    console.error('[quote convert]', fetchError)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!quote) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (quote.service_order_id) {
    const { data: existingOs } = await auth.supabase
      .from('service_orders')
      .select('id, display_number')
      .eq('id', quote.service_order_id)
      .maybeSingle()
    if (existingOs) {
      if (quote.status !== 'convertido') {
        await auth.supabase
          .from('quotes')
          .update({ status: 'convertido' })
          .eq('id', quoteId)
      }
      return NextResponse.json({
        ok: true,
        redirectTo: getOrdemPortalPath(existingOs),
      })
    }
  }

  if (!canConvertQuoteStatus(String(quote.status || ''))) {
    return NextResponse.json({ ok: false, error: 'cannot_convert' }, { status: 409 })
  }

  const items = parseQuoteItemsRaw(quote.items)
  const { data: inserted, error: insertError } = await auth.supabase
    .from('service_orders')
    .insert({
      organization_id: quote.organization_id,
      customer_id: quote.customer_id,
      title: String(quote.title || '').trim() || 'Orçamento',
      status: 'orcamento',
      created_by: auth.userId,
      seller_user_id: auth.userId,
      services: items,
      services_total_cents: Math.max(0, Number(quote.items_total_cents) || 0),
      services_cost_total_cents: Math.max(0, Number(quote.items_cost_total_cents) || 0),
      payment_methods: [],
    })
    .select('id, display_number')
    .single()

  if (insertError || !inserted) {
    console.error('[quote convert insert os]', insertError)
    return NextResponse.json({ ok: false, error: 'os_create_failed' }, { status: 500 })
  }

  const { error: upErr } = await auth.supabase
    .from('quotes')
    .update({
      status: 'convertido',
      service_order_id: inserted.id,
    })
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)

  if (upErr) {
    console.error('[quote convert mark]', upErr)
  }

  return NextResponse.json({
    ok: true,
    redirectTo: getOrdemPortalPath(inserted),
  })
}
