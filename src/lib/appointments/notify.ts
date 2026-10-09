import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'

type AppointmentNotice = {
	orderId: string
	displayNumber: number | null
	customerName: string
	model: string
	when: string
}

type PushRow = {
	endpoint: string
	p256dh: string
	auth: string
}

export async function notifyStaffOfAppointment (
	supabase: SupabaseClient,
	notice: AppointmentNotice,
) {
	const href = getOrdemPortalPath({
		id: notice.orderId,
		display_number: notice.displayNumber,
	})
	const title = 'Novo agendamento de bateria'
	const body = `${notice.customerName} · ${notice.model} · ${notice.when}`

	const [membersResult, platformResult] = await Promise.all([
		supabase
			.from('organization_members')
			.select('user_id')
			.eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
			.in('role_in_org', ['admin', 'staff']),
		supabase
			.from('users')
			.select('id')
			.eq('role', 'platform_admin'),
	])
	if (membersResult.error) console.error('[appointment-notify] members', membersResult.error)
	if (platformResult.error) console.error('[appointment-notify] platform_admin', platformResult.error)
	const userIds = [...new Set([
		...(membersResult.data ?? []).map((row) => String(row.user_id)),
		...(platformResult.data ?? []).map((row) => String(row.id)),
	].filter(Boolean))]
	if (!userIds.length) return

	const rows = userIds.map((userId) => ({
		organization_id: CONECTIZE_HOST_ORGANIZATION_ID,
		user_id: userId,
		kind: 'agendamento',
		service_order_id: notice.orderId,
		title,
		body,
		href,
	}))
	const { error: insertError } = await supabase.from('staff_notifications').insert(rows)
	if (insertError) {
		console.error('[appointment-notify] insert', insertError)
	}

	await sendWebPush(supabase, userIds, { title, body, url: href })
}

async function sendWebPush (
	supabase: SupabaseClient,
	userIds: string[],
	payload: { title: string, body: string, url: string },
) {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || ''
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || ''
	if (!publicKey || !privateKey) return

	const { data } = await supabase
		.from('push_subscriptions')
		.select('endpoint, p256dh, auth')
		.in('user_id', userIds)
	const subscriptions = (data ?? []) as PushRow[]
	if (!subscriptions.length) return

	try {
		webpush.setVapidDetails(
			process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@conectize.com.br',
			publicKey,
			privateKey,
		)
		await Promise.all(subscriptions.map(async (subscription) => {
			try {
				await webpush.sendNotification({
					endpoint: subscription.endpoint,
					keys: { p256dh: subscription.p256dh, auth: subscription.auth },
				}, JSON.stringify(payload))
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode
				if (status === 404 || status === 410) {
					await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
					return
				}
				console.error('[appointment-notify] push', status || '', err)
			}
		}))
	} catch (err) {
		console.error('[appointment-notify] push', err)
	}
}
