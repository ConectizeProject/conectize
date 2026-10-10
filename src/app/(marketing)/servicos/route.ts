import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

function listingOrigin (requestUrl: string) {
	const incoming = new URL(requestUrl)
	const host = incoming.hostname.toLowerCase()
	if (host === 'conectize.com.br' || host === 'www.conectize.com.br') {
		return 'https://www.conectize.com.br'
	}
	return incoming.origin
}

export function GET (request: Request) {
	const destination = new URL(SERVICES_HUB_PATH, listingOrigin(request.url))
	return Response.redirect(destination, 301)
}
