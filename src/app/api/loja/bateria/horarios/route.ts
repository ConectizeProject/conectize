import { NextResponse } from 'next/server'
import { listDatesWithOpenSlots, listOpenAppointmentStarts } from '@/lib/appointments/service'
import { formatSlotLabel, isDateKey } from '@/lib/appointments/slots'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET (request: Request) {
	const url = new URL(request.url)
	if (url.searchParams.get('disponiveis') === '1') {
		try {
			const supabase = createSupabaseServiceClient()
			const dates = await listDatesWithOpenSlots(supabase)
			return NextResponse.json({ dates })
		} catch (err) {
			console.error('[bateria-horarios]', err)
			return NextResponse.json({ error: 'config' }, { status: 500 })
		}
	}
	const date = url.searchParams.get('date')?.trim() || ''
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
