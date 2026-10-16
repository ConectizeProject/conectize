import { buildAppRobotsTxt } from '@/lib/seo/app-robots'
import { publicHostnameFromHeaders } from '@/lib/utils/canonical-host'
import { resolveSurface, SIMULATE_HOST_HEADER } from '@/lib/utils/host-surface'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
	const hostname = publicHostnameFromHeaders(
		request.headers,
		new URL(request.url).hostname,
	)
	const simulate =
		request.headers.get(SIMULATE_HOST_HEADER) ||
		process.env.CONECTIZE_SURFACE ||
		null
	const surface = resolveSurface(hostname, simulate)
	if (surface !== 'app') {
		return new Response('Not Found', { status: 404 })
	}

	return new Response(buildAppRobotsTxt(), {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	})
}
