'use server'

import { revalidatePath } from 'next/cache'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function markAppointmentReviewedAction (orderId: string) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) return { ok: false as const, error: auth.error }
	const id = String(orderId || '').trim()
	if (!id) return { ok: false as const, error: 'dados_invalidos' }
	const { error } = await auth.supabase
		.from('service_orders')
		.update({
			appointment_reviewed_at: new Date().toISOString(),
			appointment_reviewed_by: auth.userId,
		})
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.eq('origin', 'agendamento')
		.is('appointment_reviewed_at', null)
	if (error) return { ok: false as const, error: 'config' }
	revalidatePath('/portal/ordens')
	revalidatePath(`/portal/ordens/${id}`)
	return { ok: true as const }
}
