import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const id = parseOptionalUuid(rawId)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const name = body?.name != null ? String(body.name).trim() : undefined
  const text = body?.body != null ? String(body.body).trim() : undefined
  const isActive = body?.is_active != null ? Boolean(body.is_active) : undefined
  const isDefault = body?.is_default != null ? Boolean(body.is_default) : undefined

  if (name !== undefined && !name) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  if (text !== undefined && !text) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (text !== undefined) update.body = text
  if (isActive !== undefined) update.is_active = isActive
  if (isDefault !== undefined) update.is_default = isDefault

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  if (isDefault === true) {
    await auth.supabase
      .from('warranty_templates')
      .update({ is_default: false })
      .eq('organization_id', auth.organizationId)
      .eq('is_default', true)
      .neq('id', id)
  }

  const { data, error } = await auth.supabase
    .from('warranty_templates')
    .update(update)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .maybeSingle()

  if (error) {
    console.error('[warranty-templates] update', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, template: data })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const id = parseOptionalUuid(rawId)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('warranty_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[warranty-templates] delete', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
