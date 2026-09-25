import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

export function GET(request: Request) {
	const incoming = new URL(request.url)
	const destination = new URL(SERVICES_HUB_PATH, incoming.origin)
	destination.search = incoming.search
	return Response.redirect(destination, 301)
}
