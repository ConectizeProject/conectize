import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { applyStaffProductPatchFromBody } from '@/lib/products/apply-staff-product-patch-body'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_ITEMS = 200
/** Paralelismo no servidor: várias atualizações de DB ao mesmo tempo, uma única ida ao cliente. */
const CONCURRENCY = 12

function normalizeBulkItems (raw: unknown): Array<{ productId: string; body: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ productId: string; body: Record<string, unknown> }> = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const pid = String(o.productId || '').trim().toLowerCase()
    if (!UUID_RE.test(pid)) continue
    const body: Record<string, unknown> = { ...o }
    delete body.productId
    if (Object.keys(body).length === 0) continue
    out.push({ productId: pid, body })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { items?: unknown } | null
  const items = normalizeBulkItems(body?.items)
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'items_invalid_or_empty' }, { status: 400 })
  }

  type RowResult = { productId: string; ok: true } | { productId: string; ok: false; error: string }

  const results: RowResult[] = []
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY)
    const chunkResults = await Promise.all(
      chunk.map(async ({ productId, body }): Promise<RowResult> => {
        const r = await applyStaffProductPatchFromBody(productId, body)
        if (r.ok) return { productId, ok: true as const }
        return { productId, ok: false as const, error: r.error }
      }),
    )
    results.push(...chunkResults)
  }

  const ok = results.filter((x) => x.ok).length
  const fail = results.length - ok

  return NextResponse.json({
    ok: true,
    updated: ok,
    failed: fail,
    results,
  })
}
