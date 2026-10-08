import { NextResponse } from 'next/server'
import { listOpenAppointmentStarts } from '@/lib/appointments/service'
import { formatSlotLabel, isDateKey } from '@/lib/appointments/slots'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET (request: Request) {
	const date = new URL(request.url).searchParams.get('date')?.trim() || ''
	if (!isDateKey(date)) {
		return NextResponse.json({ slots: [] })
	}
	try {
		const supabase = createSupabaseServiceClient()
		const starts = await listOpenAppointmentStarts(supabase, date)
		return NextResponse.json({
			slots: starts.map((startsAt) => ({
				startsAt,
				label: formatSlotLabel(startsAt),
			})),
		})
	} catch (err) {
		console.error('[bateria-horarios]', err)
		return NextResponse.json({ error: 'config' }, { status: 500 })
	}
}
