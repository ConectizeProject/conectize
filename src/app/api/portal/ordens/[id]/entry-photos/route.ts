import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const BUCKET = 'order-entry-photos'

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
      .from('service_order_entry_photos')
      .select('*', { count: 'exact', head: true })
      .eq('service_order_id', orderId)

    if (error) {
      console.error('[entry-photos count]', error)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: count ?? 0 })
  }

  const { data: rows, error } = await auth.supabase
    .from('service_order_entry_photos')
    .select('id, storage_path, created_at')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[entry-photos GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const expiresIn = 60 * 60
  const photos = await Promise.all(
    (rows ?? []).map(async (row: { id: string; storage_path: string; created_at: string }) => {
      const { data: signed } = await auth.supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, expiresIn)
      return {
        id: row.id,
        url: signed?.signedUrl ?? null,
        created_at: row.created_at,
      }
    }),
  )

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
    const mime = (file as File).type || 'image/jpeg'
    const ext =
      mime.includes('png') ? 'png'
        : mime.includes('webp') ? 'webp'
          : mime.includes('heic') ? 'heic'
            : 'jpg'
    const path = `${orderId}/${randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await auth.supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: mime, upsert: false })

    if (upErr) {
      console.error('[entry-photos upload]', upErr)
      continue
    }

    const { data: ins, error: insErr } = await auth.supabase
      .from('service_order_entry_photos')
      .insert({ service_order_id: orderId, storage_path: path })
      .select('id')
      .single()

    if (!insErr && ins?.id) {
      uploaded.push({ id: ins.id })
    }
  }

  return NextResponse.json({ ok: true, photos: uploaded })
}
