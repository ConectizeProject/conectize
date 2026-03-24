import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('warranty_templates')
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const text = String(body?.body || '').trim()
  const isActive = body?.is_active != null ? Boolean(body.is_active) : true
  const isDefault = body?.is_default != null ? Boolean(body.is_default) : false

  if (!name || !text) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  if (isDefault) {
    await auth.supabase
      .from('warranty_templates')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { data: existing } = await auth.supabase
    .from('warranty_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort =
    typeof existing?.sort_order === 'number'
      ? existing.sort_order + 1
      : 0

  const { data, error } = await auth.supabase
    .from('warranty_templates')
    .insert({
      name,
      body: text,
      is_active: isActive,
      is_default: isDefault,
      sort_order: nextSort,
    })
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, template: data })
}

