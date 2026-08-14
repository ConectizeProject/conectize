import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import {
  signServiceOrderPhotoRows,
  uploadServiceOrderPhotoBlob,
} from '@/lib/orders/service-order-photo-storage'

const BUCKET = 'order-assistance-photos'
const TABLE = 'service_order_assistance_photos' as const

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const countOnly = searchParams.get('countOnly') === '1' || searchParams.get('countOnly') === 'true'

  if (countOnly) {
    const { count, error } = await auth.supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('service_order_id', orderId)

    if (error) {
      console.error('[assistance-photos count]', error)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: count ?? 0 })
  }

  const { data: rows, error } = await auth.supabase
    .from(TABLE)
    .select('id, storage_path, created_at')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[assistance-photos GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const photos = await signServiceOrderPhotoRows(auth.supabase, BUCKET, rows, 60 * 60)
  return NextResponse.json({ ok: true, photos })
}

export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files')
  const uploaded: Array<{ id: string }> = []

  for (const file of files) {
    if (!(file instanceof Blob) || file.size === 0) continue
    const saved = await uploadServiceOrderPhotoBlob({
      supabase: auth.supabase,
      bucket: BUCKET,
      table: TABLE,
      orderId,
      organizationId: auth.organizationId,
      file,
    })
    if (saved) uploaded.push(saved)
  }

  return NextResponse.json({ ok: true, photos: uploaded })
}
