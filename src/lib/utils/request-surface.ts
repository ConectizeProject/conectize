import { headers } from 'next/headers'
import { publicHostnameFromHeaders } from '@/lib/utils/canonical-host'
import {
	resolveSurface,
	SIMULATE_HOST_HEADER,
	type SiteSurface,
} from '@/lib/utils/host-surface'

/**
 * Superfície desta requisição.
 * Em produção o header de simulação é ignorado. Localhost e preview
 * respeitam `x-conectize-host` e `CONECTIZE_SURFACE`.
 */
export async function getRequestSurface(): Promise<SiteSurface> {
	const headerStore = await headers()
	const hostname = publicHostnameFromHeaders(headerStore)
	const simulate =
		headerStore.get(SIMULATE_HOST_HEADER) ||
		process.env.CONECTIZE_SURFACE ||
		null
	return resolveSurface(hostname, simulate)
}
