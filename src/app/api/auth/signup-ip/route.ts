import { NextResponse } from 'next/server'
import { consumeSignupIp, signupIpFromHeaders } from '@/lib/auth/signup-ip-limit'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function POST (request: Request) {
	try {
		const supabase = createSupabaseServiceClient()
		const allowed = await consumeSignupIp(supabase, signupIpFromHeaders(request.headers))
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'limite' }, { status: 429 })
		}
		return NextResponse.json({ ok: true })
	} catch (err) {
		console.error('[signup-ip]', err)
		return NextResponse.json({ ok: true })
	}
}
