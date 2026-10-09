import { NextResponse } from 'next/server'
import { toggleAppointmentSlotBlock } from '@/lib/appointments/service'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function POST (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	let body: { startsAt?: unknown }
	try {
		body = await request.json() as { startsAt?: unknown }
	} catch {
		return NextResponse.json({ ok: false, error: 'horario_indisponivel' }, { status: 400 })
	}
	try {
		const result = await toggleAppointmentSlotBlock(
			createSupabaseServiceClient(),
			auth.organizationId,
			auth.userId,
			String(body.startsAt || ''),
		)
		if (!result.ok) {
			const status = result.error === 'ocupado' ? 409 : 400
			return NextResponse.json(result, { status })
		}
		return NextResponse.json(result)
	} catch (err) {
		console.error('[agendamento-bloqueio]', err)
		return NextResponse.json({ ok: false, error: 'config' }, { status: 500 })
	}
}
