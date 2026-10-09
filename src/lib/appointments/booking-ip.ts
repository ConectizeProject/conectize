import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSignupIp } from '@/lib/auth/signup-ip-limit'

export const BOOKING_IP_DAILY_LIMIT = 3

function isMissingTable (error: { code?: string, message?: string } | null) {
	if (!error) return false
	const code = String(error.code || '')
	return code === '42P01' || code === 'PGRST205'
}

export async function bookingIpAllowed (supabase: SupabaseClient, ip: string) {
	const ipHash = hashSignupIp(ip)
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
	const { count, error } = await supabase
		.from('booking_ip_events')
		.select('id', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.gte('created_at', since)
	if (error) {
		console.error('[booking-ip]', isMissingTable(error) ? 'tabela ausente, limite ignorado' : error.message)
		return { allowed: true, ipHash, record: false }
	}
	if ((count ?? 0) >= BOOKING_IP_DAILY_LIMIT) {
		return { allowed: false, ipHash, record: false }
	}
	return { allowed: true, ipHash, record: true }
}

export async function recordBookingIp (supabase: SupabaseClient, ipHash: string) {
	const { error } = await supabase.from('booking_ip_events').insert({ ip_hash: ipHash })
	if (error && !isMissingTable(error)) console.error('[booking-ip] insert', error.message)
}
