import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const name = body?.name != null ? String(body.name).trim() : undefined
  const text = body?.body != null ? String(body.body).trim() : undefined
  const isActive = body?.is_active
  const isDefault = body?.is_default

  if (name !== undefined && !name) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
  }
  if (text !== undefined && !text) {
    return NextResponse.json({ ok: false, error: 'body_required' }, { status: 400 })
  }

  if (isDefault === true) {
    await auth.supabase
      .from('warranty_templates')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (name !== undefined) updatePayload.name = name
  if (text !== undefined) updatePayload.body = text
  if (isActive !== undefined) updatePayload.is_active = Boolean(isActive)
  if (isDefault !== undefined) updatePayload.is_default = Boolean(isDefault)

  const { data, error } = await auth.supabase
    .from('warranty_templates')
    .update(updatePayload)
    .eq('id', id)
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, template: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('warranty_templates')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

