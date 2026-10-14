import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const TITLE_MAX = 80
const BODY_MAX = 4000

function cleanText (value: unknown) {
  return String(value || '').trim()
}

type RouteContext = {
  params: Promise<{ id: string }>
}

async function readId (context: RouteContext) {
  const { id } = await context.params
  return parseOptionalUuid(id)
}

export async function PATCH (request: Request, context: RouteContext) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const id = await readId(context)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const record = await request.json().catch(() => null) as Record<string, unknown> | null
  const title = cleanText(record?.title)
  const body = cleanText(record?.body)
  if (!title || title.length > TITLE_MAX || !body || body.length > BODY_MAX) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('ready_messages')
    .update({
      title,
      body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select('id, title, body, updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'duplicate_title' }, { status: 409 })
    }
    console.error('[mensagens-prontas PATCH]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, message: data })
}

export async function DELETE (_request: Request, context: RouteContext) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const id = await readId(context)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('ready_messages')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[mensagens-prontas DELETE]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
