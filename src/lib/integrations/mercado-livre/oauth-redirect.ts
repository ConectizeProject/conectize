import type { NextRequest } from 'next/server'
import { MELI_OAUTH_CALLBACK_PATH } from '@/lib/integrations/mercado-livre/constants'

function normalizeUrl(value: string) {
	return value.trim().replace(/\/$/, '')
}

export function getRequestOrigin(request: NextRequest) {
	const forwardedHost = request.headers.get('x-forwarded-host')
	if (forwardedHost) {
		const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
		return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
	}

	return request.nextUrl.origin.replace(/\/$/, '')
}

export function getAppBaseUrl(request: NextRequest) {
	return getRequestOrigin(request)
}

export function getMeliRedirectUri(request: NextRequest) {
	const configured = process.env.MELI_REDIRECT_URI
	if (configured) return normalizeUrl(configured)
	return `${getRequestOrigin(request)}${MELI_OAUTH_CALLBACK_PATH}`
}
