import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const BUCKET = 'resale-device-photos'

export async function POST (
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
  if (oldPath) {
    await auth.supabase.storage.from(BUCKET).remove([oldPath])
  }

  const mime = (file as File).type || 'image/jpeg'
  const ext =
    mime.includes('png') ? 'png'
      : mime.includes('webp') ? 'webp'
        : mime.includes('heic') ? 'heic'
          : 'jpg'
  const path = `${deviceId}/${randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await auth.supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: false })

  if (upErr) {
    console.error('[resale-device photo upload]', upErr)
    return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
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
    await auth.supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const { data: signed } = await auth.supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  return NextResponse.json({
    ok: true,
    image_storage_path: path,
    signed_url: signed?.signedUrl ?? null,
  })
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
    await auth.supabase.storage.from(BUCKET).remove([path])
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
