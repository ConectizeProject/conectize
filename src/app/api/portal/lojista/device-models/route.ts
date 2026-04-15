import { NextRequest, NextResponse } from 'next/server'
import { requireRetailer } from '@/lib/auth/portal-api'

/**
 * Lista modelos com marca/tipo (somente leitura) para busca na tabela de preços do lojista.
 * Espelha o GET de `/api/portal/device-models`, com auth `requireRetailer`.
 */
export async function GET (request: NextRequest) {
  const auth = await requireRetailer()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const deviceTypeId = String(url.searchParams.get('deviceTypeId') || '').trim()

  let limit = Number.parseInt(String(url.searchParams.get('limit') || '500'), 10)
  if (Number.isNaN(limit) || limit < 1) limit = 500
  limit = Math.min(limit, 2000)

  const query = auth.supabase
    .from('device_models')
    .select('id, model, device_type_id, device_types ( id, name, device_brands ( id, name ) )')
    .order('model', { ascending: true })
    .limit(limit)

  if (deviceTypeId) query.eq('device_type_id', deviceTypeId)

  const { data, error } = await query
  if (error) {
    console.error('[lojista/device-models]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  type Dt = { name?: string | null; device_brands?: { name?: string | null } | { name?: string | null }[] | null }
  type ModelRow = {
    id: string
    model?: string | null
    device_type_id?: string
    device_types?: Dt | Dt[] | null
  }

  const rows = (data || []).map((row: ModelRow) => {
    const dt = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
    const br = dt?.device_brands
    const brand = Array.isArray(br) ? br[0] : br
    return {
      id: row.id,
      model: row.model,
      device_type_id: row.device_type_id,
      brand: brand?.name ?? null,
      device_type: dt?.name ?? null,
    }
  })

  const res = NextResponse.json({ ok: true, deviceModels: rows })
  res.headers.set('Cache-Control', 'private, max-age=300')
  return res
}
