import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SIGNUP_IP_DAILY_LIMIT = 3

export function hashSignupIp (ip: string) {
	return createHash('sha256').update(String(ip || '').trim() || 'unknown').digest('hex')
}

export function signupIpFromHeaders (headerList: { get (name: string): string | null }) {
	const forwarded = headerList.get('x-forwarded-for')
	const raw = forwarded ? forwarded.split(',')[0] : headerList.get('x-real-ip')
	return String(raw || '').trim() || 'unknown'
}

export async function consumeSignupIp (supabase: SupabaseClient, ip: string) {
	const ipHash = hashSignupIp(ip)
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
	const { count, error } = await supabase
		.from('signup_ip_events')
		.select('id', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.gte('created_at', since)
	if (error) {
		console.error('[signup-ip]', error.message)
		return true
	}
	if ((count ?? 0) >= SIGNUP_IP_DAILY_LIMIT) return false
	const { error: insertError } = await supabase.from('signup_ip_events').insert({ ip_hash: ipHash })
	if (insertError) {
		console.error('[signup-ip] insert', insertError.message)
		return true
	}
	return true
}
