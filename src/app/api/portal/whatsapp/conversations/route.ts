import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: rows, error } = await auth.supabase
    .from('whatsapp_conversations')
    .select(
      `
      id,
      wa_from,
      customer_id,
      last_message_at,
      needs_staff_attention,
      draft_os,
      service_order_id,
      created_at,
      service_orders ( display_number )
    `,
    )
    .order('last_message_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const ids = (rows || []).map((r) => r.id)
  let lastBodies: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: msgs } = await auth.supabase
      .from('whatsapp_messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
    const seen = new Set<string>()
    for (const m of msgs || []) {
      const cid = m.conversation_id as string
      if (seen.has(cid)) continue
      seen.add(cid)
      lastBodies[cid] = String(m.body || '').slice(0, 280)
    }
  }

  const conversations = (rows || []).map((r) => ({
    ...r,
    last_preview: lastBodies[r.id as string] || null,
  }))

  return NextResponse.json({ ok: true, conversations })
}
