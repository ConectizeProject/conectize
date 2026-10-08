import { NextResponse } from 'next/server'
import {
	cancelBatteryAppointment,
	createBatteryAppointment,
	rescheduleBatteryAppointment,
} from '@/lib/appointments/service'
import { getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

function clientError (error: string, status = 400) {
	return NextResponse.json({ ok: false, error }, { status })
}

export async function POST (request: Request) {
	let body: Record<string, unknown>
	try {
		body = await request.json() as Record<string, unknown>
	} catch {
		return clientError('dados_invalidos')
	}
	try {
		const supabase = createSupabaseServiceClient()
		const result = await createBatteryAppointment(supabase, {
			model: String(body.model || ''),
			startsAt: String(body.startsAt || ''),
			fullName: String(body.fullName || ''),
			email: String(body.email || ''),
			phone: String(body.phone || ''),
			cpf: String(body.cpf || ''),
			honeypot: String(body.companyWebsite || ''),
		})
		if (!result.ok) {
			const status = result.error === 'horario_indisponivel' ? 409 : 400
			return clientError(result.error, status)
		}
		return NextResponse.json(result)
	} catch (err) {
		console.error('[bateria-agendamento]', err)
		return clientError('config', 500)
	}
}

async function requireCustomer () {
	const { user } = await getAuthUser()
	if (!user?.id) return null
	return user.id
}

export async function PATCH (request: Request) {
	const userId = await requireCustomer()
	if (!userId) return clientError('nao_encontrado', 401)
	let body: Record<string, unknown>
	try {
		body = await request.json() as Record<string, unknown>
	} catch {
		return clientError('dados_invalidos')
	}
	try {
		const supabase = createSupabaseServiceClient()
		const result = await rescheduleBatteryAppointment(supabase, userId, String(body.startsAt || ''))
		if (!result.ok) {
			const status = result.error === 'horario_indisponivel' ? 409 : 400
			return clientError(result.error, status)
		}
		return NextResponse.json(result)
	} catch (err) {
		console.error('[bateria-agendamento-patch]', err)
		return clientError('config', 500)
	}
}

export async function DELETE () {
	const userId = await requireCustomer()
	if (!userId) return clientError('nao_encontrado', 401)
	try {
		const supabase = createSupabaseServiceClient()
		const result = await cancelBatteryAppointment(supabase, userId)
		if (!result.ok) return clientError(result.error)
		return NextResponse.json(result)
	} catch (err) {
		console.error('[bateria-agendamento-delete]', err)
		return clientError('config', 500)
	}
}
