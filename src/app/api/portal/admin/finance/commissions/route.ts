import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  listStaffCommissions,
  setStaffCommissionPaid,
  type StaffCommissionSource,
} from '@/lib/finance/staff-commissions'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function ymd (raw: string | null): string | null {
  const v = String(raw || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

function currentMonthRange (): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const fmt = (date: Date) => date.toISOString().slice(0, 10)
  return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m, d)) }
}

export async function GET (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const fallback = currentMonthRange()
  const from = ymd(url.searchParams.get('from')) || fallback.from
  const to = ymd(url.searchParams.get('to')) || fallback.to
  const statusRaw = String(url.searchParams.get('status') || 'all').trim()
  const sourceRaw = String(url.searchParams.get('source') || 'all').trim()
  const status =
    statusRaw === 'pending' || statusRaw === 'paid' ? statusRaw : 'all'
  const source =
    sourceRaw === 'os' || sourceRaw === 'resale' ? sourceRaw : 'all'

  try {
    const items = await listStaffCommissions(auth.supabase, {
      organizationId: auth.organizationId,
      from,
      to,
      status,
      source,
    })

    const pendingCents = items
      .filter((i) => !i.isPaid)
      .reduce((sum, i) => sum + i.amountCents, 0)
    const paidCents = items
      .filter((i) => i.isPaid)
      .reduce((sum, i) => sum + i.amountCents, 0)

    return NextResponse.json({
      ok: true,
      from,
      to,
      items,
      totals: {
        pendingCents,
        paidCents,
        totalCents: pendingCents + paidCents,
        count: items.length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed'
    console.error('[finance/commissions GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PATCH (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const sourceRaw = String(body?.source || '').trim()
  const source: StaffCommissionSource | null =
    sourceRaw === 'os' || sourceRaw === 'resale' ? sourceRaw : null
  const sourceId = parseOptionalUuid(String(body?.sourceId || body?.source_id || ''))
  const paid = body?.paid === true || body?.paid === '1' || body?.paid === 1

  if (!source || !sourceId) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const result = await setStaffCommissionPaid(
      auth.supabase,
      auth.organizationId,
      source,
      sourceId,
      paid,
    )
    return NextResponse.json({
      ok: true,
      source,
      sourceId,
      paid,
      paidAt: result.paidAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    if (message === 'not_found') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    console.error('[finance/commissions PATCH]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
