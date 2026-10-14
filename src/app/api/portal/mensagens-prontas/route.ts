import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

const TITLE_MAX = 80
const BODY_MAX = 4000

function cleanText (value: unknown) {
  return String(value || '').trim()
}

function readPayload (body: unknown) {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null
  const title = cleanText(record?.title)
  const message = cleanText(record?.body)
  if (!title || title.length > TITLE_MAX || !message || message.length > BODY_MAX) {
    return null
  }
  return { title, body: message }
}

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('ready_messages')
    .select('id, title, body, updated_at')
    .eq('organization_id', auth.organizationId)
    .order('title', { ascending: true })

  if (error) {
    console.error('[mensagens-prontas GET]', error.message, error.code)
    const message = process.env.NODE_ENV === 'development' ? error.message : undefined
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messages: data || [] })
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const payload = readPayload(await request.json().catch(() => null))
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('ready_messages')
    .insert({
      organization_id: auth.organizationId,
      title: payload.title,
      body: payload.body,
    })
    .select('id, title, body, updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'duplicate_title' }, { status: 409 })
    }
    console.error('[mensagens-prontas POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: data })
}
