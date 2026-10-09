import { NextResponse } from 'next/server'
import { listAppointmentsBetween, listBlockedStarts, listDayAppointments } from '@/lib/appointments/service'
import { addDateKeyDays, isDateKey } from '@/lib/appointments/slots'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	const url = new URL(request.url)
	const from = url.searchParams.get('from')?.trim() || ''
	const to = url.searchParams.get('to')?.trim() || ''
	if (isDateKey(from) && isDateKey(to)) {
		if (from > to || addDateKeyDays(from, 13) < to) {
			return NextResponse.json({ orders: [] })
		}
		const orders = await listAppointmentsBetween(auth.supabase, auth.organizationId, from, to)
		let blocks: string[] = []
		try {
			blocks = await listBlockedStarts(createSupabaseServiceClient(), auth.organizationId, from, to)
		} catch (err) {
			console.error('[agendamentos] bloqueios', err)
		}
		return NextResponse.json({ orders, blocks })
	}
	const date = url.searchParams.get('date')?.trim() || ''
	if (!isDateKey(date)) {
		return NextResponse.json({ slots: [] })
	}
	const slots = await listDayAppointments(auth.supabase, auth.organizationId, date)
	return NextResponse.json({ slots })
}
