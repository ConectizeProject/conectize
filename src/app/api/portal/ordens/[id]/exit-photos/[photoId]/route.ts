import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { deleteServiceOrderPhotoFile } from '@/lib/orders/service-order-photo-storage'
import { handlePortalServiceOrderPhotoFileGet } from '@/lib/orders/serve-service-order-photo'

const BUCKET = 'order-exit-photos'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params
  return handlePortalServiceOrderPhotoFileGet({
    request,
    orderIdRaw: id,
    photoIdRaw: photoId,
    table: 'service_order_exit_photos',
    bucket: BUCKET,
  })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawOrderId, photoId: rawPhotoId } = await params
  const orderId = parseOptionalUuid(rawOrderId)
  const photoId = parseOptionalUuid(rawPhotoId)
  if (!orderId || !photoId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: row, error: findErr } = await auth.supabase
    .from('service_order_exit_photos')
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('service_order_id', orderId)
    .maybeSingle()

  if (findErr || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const storagePath = String(row.storage_path || '')
  if (storagePath) {
    await deleteServiceOrderPhotoFile(auth.supabase, BUCKET, storagePath)
  }

  const { error: delErr } = await auth.supabase
    .from('service_order_exit_photos')
    .delete()
    .eq('id', photoId)
    .eq('service_order_id', orderId)

  if (delErr) {
    console.error('[exit-photos DELETE]', delErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
