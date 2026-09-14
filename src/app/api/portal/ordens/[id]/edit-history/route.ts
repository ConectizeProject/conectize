import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function GET (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const trimmed = parseOptionalUuid(rawId)
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  // Garante que a OS existe e o usuário autenticado tem acesso (RLS do cliente de sessão).
  const { data: order, error: orderError } = await auth.supabase
    .from('service_orders')
    .select('id, organization_id')
    .eq('id', trimmed)
    .maybeSingle()

  if (orderError) {
    console.error('[edit-history] order lookup', orderError)
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 })
  }
  if (!order?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const organizationId = String(order.organization_id || auth.organizationId || '').trim()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: 'no_organization_context' }, { status: 403 })
  }

  let historyClient = auth.supabase
  try {
    historyClient = createSupabaseServiceClient()
  } catch (err) {
    console.warn('[edit-history] service client unavailable, using session client', err)
  }

  const { data: rows, error } = await historyClient
    .from('service_order_edit_history')
    .select('id, edited_at, edited_by, field_key, old_value, new_value')
    .eq('service_order_id', trimmed)
    .eq('organization_id', organizationId)
    .order('edited_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[edit-history]', error)
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 })
  }

  const list = rows ?? []
  const editorIds = [...new Set(list.map((r) => r.edited_by).filter(Boolean))] as string[]
  let editorsById = new Map<string, { full_name: string | null; email: string | null }>()
  if (editorIds.length > 0) {
    const { data: editors } = await historyClient
      .from('users')
      .select('id, full_name, email')
      .in('id', editorIds)
    editorsById = new Map(
      (editors ?? []).map((u) => [u.id, { full_name: u.full_name, email: u.email }]),
    )
  }

  const entries = list.map((r) => {
    const ed = editorsById.get(r.edited_by)
    const name = String(ed?.full_name || '').trim() || String(ed?.email || '').trim() || '(Sem nome)'
    return {
      id: r.id,
      edited_at: r.edited_at,
      edited_by: r.edited_by,
      editor_display_name: name,
      field_key: r.field_key,
      old_value: r.old_value,
      new_value: r.new_value,
    }
  })

  return NextResponse.json({ ok: true, entries })
}
