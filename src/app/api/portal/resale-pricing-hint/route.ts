import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { fetchSeminovosDevices } from '@/lib/seminovos/fetch-seminovos-data'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const deviceName = String(searchParams.get('deviceName') || '').trim()
  const storageGb = String(searchParams.get('storageGb') || '').trim()
  const condition = String(searchParams.get('condition') || '').trim()

  if (!deviceName) {
    return NextResponse.json({ ok: true, hint: null })
  }

  const devices = await fetchSeminovosDevices(auth.supabase, {
    q: '',
    condition,
    storageGb,
    color: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    stockType: 'seminovo',
    deviceName,
  })

  const matchStorage = (d: { storage_gb?: string | null }) => {
    if (!storageGb) return true
    const a = String(d.storage_gb || '').replace(/\D/g, '')
    const b = storageGb.replace(/\D/g, '')
    return a === b || String(d.storage_gb || '').includes(storageGb)
  }

  const candidates = devices
    .filter((d) => matchStorage(d))
    .filter((d) => (d.purchase_value_cents ?? 0) > 0)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const best = candidates[0]
  if (!best) {
    return NextResponse.json({ ok: true, hint: null })
  }

  return NextResponse.json({
    ok: true,
    hint: {
      purchase_value_cents: best.purchase_value_cents,
      wholesale_value_cents: best.wholesale_value_cents,
      sale_value_cents: best.sale_value_cents,
    },
  })
}
