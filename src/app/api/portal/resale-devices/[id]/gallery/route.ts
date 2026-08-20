import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { uploadCompressedImageWithThumb } from '@/lib/image/upload-compressed-image'
import {
  createSignedPhotoUrls,
  removeStoragePathsWithThumbs,
} from '@/lib/image/signed-photo-urls'

const BUCKET = 'resale-device-photos'
const MAX_GALLERY = 9

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
      .select('id, image_gallery_paths')
      .eq('id', deviceId)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const cur = Array.isArray((existing as { image_gallery_paths?: string[] | null }).image_gallery_paths)
      ? [...(existing as { image_gallery_paths: string[] }).image_gallery_paths].filter(Boolean)
      : []
    if (cur.length >= MAX_GALLERY) {
      return NextResponse.json({ ok: false, error: 'gallery_full' }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files')
    const file = files.find((f) => f instanceof Blob && f.size > 0) as File | Blob | undefined
    if (!file) {
      return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 })
    }

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
    const next = [...cur, path]
    const { error: updErr } = await auth.supabase
      .from('resale_devices')
      .update({ image_gallery_paths: next })
      .eq('id', deviceId)

    if (updErr) {
      console.error('[resale-device gallery db]', updErr)
      await removeStoragePathsWithThumbs(auth.supabase, BUCKET, [path])
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const signed = await createSignedPhotoUrls(auth.supabase, BUCKET, path, 3600)

    return NextResponse.json({
      ok: true,
      image_gallery_paths: next,
      signed_url: signed.thumbUrl ?? signed.url,
      signed_full_url: signed.url,
      path,
    })
  } catch (err) {
    console.error('[resale-device gallery]', err)
    return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
  }
}

export async function DELETE (
  request: NextRequest,
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

  const url = new URL(request.url)
  const path = String(url.searchParams.get('path') || '').trim()
  if (!path) {
    return NextResponse.json({ ok: false, error: 'missing_path' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await auth.supabase
    .from('resale_devices')
    .select('image_gallery_paths')
    .eq('id', deviceId)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const cur = Array.isArray((existing as { image_gallery_paths?: string[] | null }).image_gallery_paths)
    ? [...(existing as { image_gallery_paths: string[] }).image_gallery_paths].filter(Boolean)
    : []
  if (!cur.includes(path)) {
    return NextResponse.json({ ok: false, error: 'path_not_in_gallery' }, { status: 400 })
  }

  await removeStoragePathsWithThumbs(auth.supabase, BUCKET, [path])
  const next = cur.filter((p) => p !== path)

  const { error: updErr } = await auth.supabase
    .from('resale_devices')
    .update({ image_gallery_paths: next })
    .eq('id', deviceId)

  if (updErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, image_gallery_paths: next })
}
