import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

/** GET: lista fotos (com URLs assinadas) ou só contagem (?countOnly=1) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const countOnly = searchParams.get('countOnly') === '1'

  if (countOnly) {
    const { count, error } = await auth.supabase
      .from('service_order_entry_photos')
      .select('*', { count: 'exact', head: true })
      .eq('service_order_id', id)
    if (error) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: count ?? 0 })
  }

  const { data: rows, error } = await auth.supabase
    .from('service_order_entry_photos')
    .select('id, storage_path, created_at')
    .eq('service_order_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const serviceClient = createSupabaseServiceClient()
  const expiresIn = 60 * 60 // 1h
  const photos = await Promise.all(
    (rows || []).map(async (row) => {
      const { data: signed } = await serviceClient.storage
        .from('order-entry-photos')
        .createSignedUrl(row.storage_path, expiresIn)
      return {
        id: row.id,
        url: signed?.signedUrl ?? null,
        created_at: row.created_at,
      }
    })
  )

  return NextResponse.json({ ok: true, photos })
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/** POST: upload de uma ou mais fotos (multipart/form-data, campo "files" ou "file") */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const formData = await request.formData()
  const files: File[] = []
  const filesField = formData.getAll('files')
  if (filesField.length > 0) {
    for (const f of filesField) {
      if (f instanceof File && f.size > 0) files.push(f)
    }
  } else {
    const single = formData.get('file')
    if (single instanceof File && single.size > 0) files.push(single)
  }

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_files' }, { status: 400 })
  }

  const inserted: Array<{ id: string; created_at: string }> = []
  for (const file of files) {
    const mime = file.type || 'image/jpeg'
    if (!ALLOWED_TYPES.has(mime)) continue
    if (file.size > MAX_SIZE) continue

    const ext = mime === 'image/heic' ? 'heic' : mime.split('/')[1] || 'jpg'
    const storagePath = `${id}/${crypto.randomUUID()}.${ext}`

    const buf = await file.arrayBuffer()
    const { error: uploadError } = await auth.supabase.storage
      .from('order-entry-photos')
      .upload(storagePath, buf, { contentType: mime, upsert: false })

    if (uploadError) {
      return NextResponse.json({ ok: false, error: 'upload_error' }, { status: 500 })
    }

    const { data: insertedRow, error: insertError } = await auth.supabase
      .from('service_order_entry_photos')
      .insert({ service_order_id: id, storage_path: storagePath })
      .select('id, created_at')
      .single()

    if (insertError) {
      await auth.supabase.storage.from('order-entry-photos').remove([storagePath])
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    if (insertedRow) inserted.push(insertedRow)
  }

  return NextResponse.json({ ok: true, photos: inserted })
}
