import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { toThumbStoragePath } from '@/lib/image/storage-paths'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceOrderPhotoTable } from '@/lib/orders/service-order-photo-storage'
import { contentTypeForPhoto } from '@/lib/orders/photo-content-type'

async function fileToBytes (data: Blob): Promise<Uint8Array> {
  return new Uint8Array(await data.arrayBuffer())
}

export async function downloadStoragePhotoResponse (opts: {
  bucket: string
  storagePath: string
  variant: 'full' | 'thumb'
}): Promise<NextResponse> {
  const path = opts.storagePath.trim()
  if (!path) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const service = createSupabaseServiceClient()
  const thumbPath = toThumbStoragePath(path)
  const tryPaths =
    opts.variant === 'thumb' && thumbPath !== path ? [thumbPath, path] : [path]

  for (const candidate of tryPaths) {
    const { data, error } = await service.storage
      .from(opts.bucket)
      .download(candidate)
    if (error || !data) {
      if (error) console.error('[downloadStoragePhotoResponse]', opts.bucket, candidate, error.message)
      continue
    }
    const body = await fileToBytes(data)
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentTypeForPhoto(candidate, data.type),
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

function photoVariantFromRequest (request: NextRequest): 'full' | 'thumb' {
  return request.nextUrl.searchParams.get('variant') === 'full' ? 'full' : 'thumb'
}

export async function handlePortalServiceOrderPhotoFileGet (opts: {
  request: NextRequest
  orderIdRaw: string
  photoIdRaw: string
  table: ServiceOrderPhotoTable
  bucket: string
}): Promise<NextResponse> {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const orderId = parseOptionalUuid(opts.orderIdRaw)
  const photoId = parseOptionalUuid(opts.photoIdRaw)
  if (!orderId || !photoId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: row, error } = await auth.supabase
    .from(opts.table)
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('service_order_id', orderId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return downloadStoragePhotoResponse({
    bucket: opts.bucket,
    storagePath: String(row.storage_path || ''),
    variant: photoVariantFromRequest(opts.request),
  })
}
