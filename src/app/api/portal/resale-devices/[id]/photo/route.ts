import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { uploadCompressedImageWithThumb } from '@/lib/image/upload-compressed-image'
import {
  createSignedPhotoUrls,
  removeStoragePathsWithThumbs,
} from '@/lib/image/signed-photo-urls'

const BUCKET = 'resale-device-photos'

export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireStaffOrAdmin()
    if (auth.ok === false) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const { id: rawId } = await params
    const deviceId = parseOptionalUuid(rawId)
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
    }

    const { data: existing, error: fetchErr } = await auth.supabase
      .from('resale_devices')
      .select('id, image_storage_path')
      .eq('id', deviceId)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files')
    const file = files.find((f) => f instanceof Blob && f.size > 0) as File | Blob | undefined
    if (!file) {
      return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 })
    }

    const oldPath = (existing as { image_storage_path?: string | null }).image_storage_path?.trim()
    const bytes = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadCompressedImageWithThumb({
      supabase: auth.supabase,
      bucket: BUCKET,
      folder: deviceId,
      bytes,
    })
    if ('error' in uploaded) {
      return NextResponse.json({ ok: false, error: uploaded.error }, { status: 500 })
    }

    const path = uploaded.path
    if (oldPath) {
      await removeStoragePathsWithThumbs(auth.supabase, BUCKET, [oldPath])
    }

    const { error: updErr } = await auth.supabase
      .from('resale_devices')
      .update({
        image_storage_path: path,
        image_url: null,
      })
      .eq('id', deviceId)

    if (updErr) {
      console.error('[resale-device photo db]', updErr)
      await removeStoragePathsWithThumbs(auth.supabase, BUCKET, [path])
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const signed = await createSignedPhotoUrls(auth.supabase, BUCKET, path, 3600)

    return NextResponse.json({
      ok: true,
      image_storage_path: path,
      signed_url: signed.thumbUrl ?? signed.url,
      signed_full_url: signed.url,
    })
  } catch (err) {
    console.error('[resale-device photo]', err)
    return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
  }
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const deviceId = parseOptionalUuid(rawId)
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await auth.supabase
    .from('resale_devices')
    .select('image_storage_path')
    .eq('id', deviceId)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const path = (existing as { image_storage_path?: string | null }).image_storage_path?.trim()
  if (path) {
    await removeStoragePathsWithThumbs(auth.supabase, BUCKET, [path])
  }

  const { error: updErr } = await auth.supabase
    .from('resale_devices')
    .update({ image_storage_path: null })
    .eq('id', deviceId)

  if (updErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
