import { NextResponse } from 'next/server'
import { listDayAppointments } from '@/lib/appointments/service'
import { isDateKey } from '@/lib/appointments/slots'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ error: auth.error }, { status: auth.status })
	}
	const date = new URL(request.url).searchParams.get('date')?.trim() || ''
	if (!isDateKey(date)) {
		return NextResponse.json({ slots: [] })
	}
	const slots = await listDayAppointments(auth.supabase, auth.organizationId, date)
	return NextResponse.json({ slots })
}
