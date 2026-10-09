import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET () {
	return NextResponse.json({
		publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || '',
	})
}

export async function POST (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	let body: { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
	try {
		body = await request.json() as { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
	} catch {
		return NextResponse.json({ ok: false }, { status: 400 })
	}
	const endpoint = String(body.endpoint || '').trim()
	const p256dh = String(body.keys?.p256dh || '').trim()
	const authKey = String(body.keys?.auth || '').trim()
	if (!endpoint || !p256dh || !authKey) {
		return NextResponse.json({ ok: false }, { status: 400 })
	}
	const supabase = createSupabaseServiceClient()
	const { error } = await supabase
		.from('push_subscriptions')
		.upsert({
			user_id: auth.userId,
			endpoint,
			p256dh,
			auth: authKey,
		}, { onConflict: 'user_id,endpoint' })
	if (error) {
		console.error('[push-subscriptions]', error)
		return NextResponse.json({ ok: false }, { status: 500 })
	}
	return NextResponse.json({ ok: true })
}
