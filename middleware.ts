import { PORTAL_INTENDED_PATH_HEADER } from '@/lib/auth/portal-intended-path'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware (request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const intendedPath =
		pathname.startsWith('/portal')
			? `${pathname}${request.nextUrl.search}`
			: ''

	function buildRequestHeaders (): Headers {
		const h = new Headers(request.headers)
		if (intendedPath) {
			h.set(PORTAL_INTENDED_PATH_HEADER, intendedPath)
		}
		return h
	}

	return NextResponse.next({
		request: {
			headers: buildRequestHeaders(),
		},
	})
}

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
	],
}
