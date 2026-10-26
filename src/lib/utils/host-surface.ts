import {
	canonicalRedirectStatus,
	isLocalOrPreviewHost,
	normalizeHostname,
} from '@/lib/utils/canonical-host'
import { resolvePublicCrawlRedirect } from '@/lib/utils/public-crawl-redirect'
import {
	APP_HOST,
	APP_SITE_ORIGIN,
	CANONICAL_HOST,
	CANONICAL_SITE_ORIGIN,
	APEX_HOST,
} from '@/lib/utils/site-url'

/**
 * Header para simular o host em localhost e preview (*.vercel.app).
 * Valores: `app` ou `www`. Em produção o header é ignorado.
 * O env `CONECTIZE_SURFACE` tem o mesmo efeito quando o header não vem.
 */
export const SIMULATE_HOST_HEADER = 'x-conectize-host'

export type SiteSurface = 'store' | 'app' | 'neutral'
export type PublicPathKind = 'shared' | 'saas' | 'store'

const ASSET_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'webp',
	'gif',
	'svg',
	'ico',
	'avif',
	'css',
	'js',
	'map',
	'woff',
	'woff2',
	'ttf',
	'eot',
	'webmanifest',
])

const SAAS_PREFIXES = [
	'/planos',
	'/manual',
	'/portal',
	'/os',
	'/orcamento',
	'/cadastro-empresa',
	'/cadastro-cliente',
] as const

function normalizeProtocol(protocol: string): string {
	return protocol.replace(/:$/, '').split(',')[0]?.trim().toLowerCase() || ''
}

function normalizeSearch(search: string): string {
	if (!search) return ''
	return search.startsWith('?') ? search : `?${search}`
}

function normalizeSimulate(
	value: string | null | undefined,
): 'app' | 'store' | null {
	const raw = (value || '').trim().toLowerCase()
	if (!raw) return null
	if (raw === 'app' || raw === APP_HOST) return 'app'
	if (raw === 'www' || raw === 'store' || raw === CANONICAL_HOST) return 'store'
	return null
}

/**
 * Superfície da requisição.
 * Localhost, preview e hosts desconhecidos ficam neutros (servem loja e SaaS)
 * salvo simulação por header ou env.
 */
export function resolveSurface(
	hostname: string,
	simulateHost?: string | null,
): SiteSurface {
	const host = normalizeHostname(hostname)
	if (!host) return 'neutral'
	if (isLocalOrPreviewHost(host)) {
		const forced = normalizeSimulate(simulateHost)
		if (forced === 'app') return 'app'
		if (forced === 'store') return 'store'
		return 'neutral'
	}
	if (host === APP_HOST) return 'app'
	if (host === CANONICAL_HOST || host === APEX_HOST) return 'store'
	return 'neutral'
}

function isStaticAsset(pathname: string): boolean {
	const last = pathname.split('/').pop() || ''
	const dot = last.lastIndexOf('.')
	if (dot <= 0) return false
	return ASSET_EXTENSIONS.has(last.slice(dot + 1).toLowerCase())
}

function matchesPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Classifica o path já normalizado (sem barra final, salvo a raiz).
 * `shared` funciona nos dois hosts: API, OAuth, webhook, assets, robots e sitemap.
 */
export function classifyPublicPath(pathname: string): PublicPathKind {
	const path =
		pathname.length > 1 && pathname.endsWith('/')
			? pathname.slice(0, -1)
			: pathname

	if (path === '/robots.txt' || path === '/sitemap.xml') return 'shared'
	if (
		path === '/portal/auth/callback' ||
		path.startsWith('/portal/auth/callback/')
	)
		return 'shared'
	if (path === '/api' || path.startsWith('/api/')) return 'shared'
	if (path === '/_next' || path.startsWith('/_next/')) return 'shared'
	if (path === '/.well-known' || path.startsWith('/.well-known/'))
		return 'shared'
	if (
		path === '/apple-app-site-association' ||
		path === '/favicon.ico' ||
		path.startsWith('/favicon')
	) {
		return 'shared'
	}
	if (isStaticAsset(path)) return 'shared'
	if (SAAS_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) return 'saas'
	return 'store'
}

function requestOrigin(hostname: string, protocol: string): string {
	const host = normalizeHostname(hostname)
	const local = isLocalOrPreviewHost(host)
	const proto = normalizeProtocol(protocol) || (local ? 'http' : 'https')
	if (!local) return `${proto}://${host}`
	const raw =
		hostname.split(',')[0]?.trim().toLowerCase().replace(/\.$/, '') || host
	return `${proto}://${raw}`
}

function destinationOrigin(input: {
	surface: SiteSurface
	kind: PublicPathKind
	hostname: string
	protocol: string
}): string {
	const host = normalizeHostname(input.hostname)
	const local = isLocalOrPreviewHost(host)

	if (
		input.surface === 'neutral' ||
		(local && input.kind !== 'store' && input.kind !== 'saas')
	) {
		return requestOrigin(input.hostname, input.protocol)
	}

	if (input.kind === 'shared') {
		if (local) return requestOrigin(input.hostname, input.protocol)
		if (input.surface === 'app') return APP_SITE_ORIGIN
		return CANONICAL_SITE_ORIGIN
	}

	if (input.kind === 'saas') {
		if (input.surface === 'app' && local)
			return requestOrigin(input.hostname, input.protocol)
		return APP_SITE_ORIGIN
	}

	if (input.surface === 'store' && local)
		return requestOrigin(input.hostname, input.protocol)
	return CANONICAL_SITE_ORIGIN
}

export type HostSplitInput = {
	hostname: string
	protocol: string
	pathname: string
	search?: string
	simulateHost?: string | null
}

/**
 * URL absoluta final da requisição, ou null quando ela já está no host e no path certos.
 * Junta host canônico, path legado e separação loja/SaaS num único salto.
 */
export function resolveHostSplitRedirect(input: HostSplitInput): string | null {
	const hostname = normalizeHostname(input.hostname)
	if (!hostname) return null

	const surface = resolveSurface(hostname, input.simulateHost)
	const rawSearch = normalizeSearch(input.search || '')
	const searchParams = new URLSearchParams(
		rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch,
	)
	const crawl = resolvePublicCrawlRedirect({
		pathname: input.pathname,
		searchParams,
		host: hostname,
	})

	let pathname = crawl?.pathname ?? input.pathname
	let search = crawl?.search ?? rawSearch
	let kind = classifyPublicPath(pathname)

	if (surface === 'app' && pathname === '/') {
		pathname = '/planos'
		kind = 'saas'
	}

	const origin = destinationOrigin({
		surface,
		kind,
		hostname: input.hostname,
		protocol: input.protocol,
	})
	const target = `${origin}${pathname}${search}`
	const current = `${requestOrigin(input.hostname, input.protocol)}${input.pathname}${rawSearch}`
	if (target === current) return null
	return target
}

/** GET/HEAD 301. Demais métodos 308, para não descartar corpo de POST. */
export function hostSplitRedirect(
	input: HostSplitInput & { method: string },
): { url: string; status: 301 | 308 } | null {
	const url = resolveHostSplitRedirect(input)
	if (!url) return null
	return { url, status: canonicalRedirectStatus(input.method) }
}

/** Rewrite interno de robots/sitemap quando a superfície é o app. */
export function appSeoRewritePath(
	pathname: string,
): '/internal/app-robots' | '/internal/app-sitemap' | null {
	if (pathname === '/robots.txt') return '/internal/app-robots'
	if (pathname === '/sitemap.xml') return '/internal/app-sitemap'
	return null
}
