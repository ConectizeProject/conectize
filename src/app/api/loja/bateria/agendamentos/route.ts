import { NextResponse } from 'next/server'
import {
	cancelBatteryAppointment,
	createBatteryAppointment,
	rescheduleBatteryAppointment,
} from '@/lib/appointments/service'
import { signupIpFromHeaders } from '@/lib/auth/signup-ip-limit'
import { getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

function clientError (error: string, status = 400, extra?: Record<string, unknown>) {
	return NextResponse.json({ ok: false, error, ...extra }, { status })
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
		const visit = body.visit && typeof body.visit === 'object'
			? body.visit as Record<string, unknown>
			: {}
		const result = await createBatteryAppointment(supabase, {
			model: String(body.model || ''),
			startsAt: String(body.startsAt || ''),
			fullName: String(body.fullName || ''),
			email: String(body.email || ''),
			phone: String(body.phone || ''),
			cpf: String(body.cpf || ''),
			honeypot: String(body.companyWebsite || ''),
			confirmExtra: body.confirmExtra === true,
			clientIp: signupIpFromHeaders(request.headers),
			visit: {
				path: String(visit.path || ''),
				search: String(visit.search || ''),
				referrer: String(visit.referrer || ''),
			},
		})
		if (!result.ok) {
			const status = result.error === 'horario_indisponivel' || result.error === 'ja_agendado'
				? 409
				: result.error === 'limite_ip'
					? 429
					: 400
			const appointments = 'appointments' in result ? result.appointments : undefined
			return clientError(result.error, status, appointments ? { appointments } : undefined)
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
