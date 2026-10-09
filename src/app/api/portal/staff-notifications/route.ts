import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET () {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	const { data, error } = await auth.supabase
		.from('staff_notifications')
		.select('id, title, body, href, created_at, service_order_id')
		.eq('user_id', auth.userId)
		.is('read_at', null)
		.order('created_at', { ascending: false })
		.limit(8)
	if (error) {
		return NextResponse.json({ notifications: [] })
	}
	return NextResponse.json({ notifications: data ?? [] })
}

export async function POST (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	let body: { id?: string }
	try {
		body = await request.json() as { id?: string }
	} catch {
		return NextResponse.json({ ok: false }, { status: 400 })
	}
	const id = String(body.id || '').trim()
	if (!id) return NextResponse.json({ ok: false }, { status: 400 })
	const supabase = createSupabaseServiceClient()
	const { error } = await supabase
		.from('staff_notifications')
		.update({ read_at: new Date().toISOString() })
		.eq('id', id)
		.eq('user_id', auth.userId)
	if (error) return NextResponse.json({ ok: false }, { status: 500 })
	return NextResponse.json({ ok: true })
}
