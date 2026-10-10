import { describe, expect, it } from 'vitest'
import { APP_SITE_ORIGIN, CANONICAL_SITE_ORIGIN } from '@/lib/utils/site-url'
import {
	appSeoRewritePath,
	classifyPublicPath,
	hostSplitRedirect,
	resolveHostSplitRedirect,
} from '@/lib/utils/host-surface'

const WWW = 'www.conectize.com.br'
const APP = 'app.conectize.com.br'
const APEX = 'conectize.com.br'

function split(input: {
	hostname: string
	pathname: string
	protocol?: string
	search?: string
	simulateHost?: string | null
	method?: string
}) {
	return hostSplitRedirect({
		hostname: input.hostname,
		protocol: input.protocol || 'https',
		pathname: input.pathname,
		search: input.search || '',
		simulateHost: input.simulateHost,
		method: input.method || 'GET',
	})
}

describe('classifyPublicPath', () => {
	it('keeps APIs, OAuth callbacks and assets on both hosts', () => {
		expect(classifyPublicPath('/api/portal/bling/webhook')).toBe('shared')
		expect(classifyPublicPath('/api/portal/mercado-livre/webhook')).toBe(
			'shared',
		)
		expect(classifyPublicPath('/api/webhooks/whatsapp')).toBe('shared')
		expect(classifyPublicPath('/api/portal/hub/oauth/bling/callback')).toBe(
			'shared',
		)
		expect(
			classifyPublicPath('/api/portal/hub/oauth/mercado-livre/callback'),
		).toBe('shared')
		expect(classifyPublicPath('/portal/auth/callback')).toBe('shared')
		expect(classifyPublicPath('/robots.txt')).toBe('shared')
		expect(classifyPublicPath('/sitemap.xml')).toBe('shared')
		expect(classifyPublicPath('/logo_conectize.svg')).toBe('shared')
	})

	it('marks SaaS pages and leaves the store on www', () => {
		expect(classifyPublicPath('/planos')).toBe('saas')
		expect(classifyPublicPath('/manual/bling')).toBe('saas')
		expect(classifyPublicPath('/portal/login')).toBe('saas')
		expect(classifyPublicPath('/os/token')).toBe('saas')
		expect(classifyPublicPath('/orcamento/token')).toBe('saas')
		expect(classifyPublicPath('/cadastro-empresa')).toBe('saas')
		expect(classifyPublicPath('/cadastro-cliente')).toBe('saas')
		expect(classifyPublicPath('/')).toBe('store')
		expect(classifyPublicPath('/contato')).toBe('store')
		expect(classifyPublicPath('/loja/acessorios')).toBe('store')
		expect(classifyPublicPath('/llms.txt')).toBe('store')
	})
})

describe('resolveHostSplitRedirect', () => {
	it('sends SaaS pages from www and apex to app in one hop', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/planos',
				search: '?utm=1',
			}),
		).toBe(`${APP_SITE_ORIGIN}/planos?utm=1`)

		expect(
			resolveHostSplitRedirect({
				hostname: APEX,
				protocol: 'http',
				pathname: '/manual/bling/',
				search: '',
			}),
		).toBe(`${APP_SITE_ORIGIN}/manual/bling`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/portal/login',
				search: '?redirectTo=%2Fportal',
			}),
		).toBe(`${APP_SITE_ORIGIN}/portal/login?redirectTo=%2Fportal`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/os/abc',
				search: '',
			}),
		).toBe(`${APP_SITE_ORIGIN}/os/abc`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/cadastro-cliente',
				search: '?org=loja',
			}),
		).toBe(`${APP_SITE_ORIGIN}/cadastro-cliente?org=loja`)
	})

	it('sends store pages from app to www and keeps the store home on www', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/contato',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/contato`)

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/loja/',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/loja`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/contato',
				search: '',
			}),
		).toBeNull()
	})

	it('uses /planos as the app home', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/',
				search: '?utm=1',
			}),
		).toBe(`${APP_SITE_ORIGIN}/planos?utm=1`)

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/planos',
				search: '',
			}),
		).toBeNull()
	})

	it('does not redirect webhooks or OAuth callbacks across hosts', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/api/portal/bling/webhook',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/api/portal/mercado-livre/webhook',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/api/webhooks/whatsapp',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/api/portal/hub/oauth/bling/callback',
				search: '?code=1',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/portal/auth/callback',
				search: '?code=abc',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/portal/auth/callback',
				search: '?code=abc',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APEX,
				protocol: 'https',
				pathname: '/portal/auth/callback',
				search: '?code=abc',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/portal/auth/callback?code=abc`)
	})

	it('upgrades http on the canonical host and keeps legacy store paths on www', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: APEX,
				protocol: 'http',
				pathname: '/contato',
				search: '?q=1',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/contato?q=1`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'http',
				pathname: '/loja',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/loja`)

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'http',
				pathname: '/portal/login',
				search: '',
			}),
		).toBe(`${APP_SITE_ORIGIN}/portal/login`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/acessorios',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/loja/acessorios`)

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/acessorios',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/loja/acessorios`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/home',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/`)
	})

	it('serves assets and host-specific seo files without crossing hosts', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/logo_conectize.svg',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/robots.txt',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/sitemap.xml',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: APP,
				protocol: 'https',
				pathname: '/llms.txt',
				search: '',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/llms.txt`)
	})

	it('leaves localhost and vercel previews alone unless the app host is simulated', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: 'localhost:3000',
				protocol: 'http',
				pathname: '/planos',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: 'localhost:3000',
				protocol: 'http',
				pathname: '/contato/',
				search: '',
			}),
		).toBe('http://localhost:3000/contato')

		expect(
			resolveHostSplitRedirect({
				hostname: 'conectize-git-abc.vercel.app',
				protocol: 'https',
				pathname: '/portal/login',
				search: '',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: 'localhost',
				protocol: 'http',
				pathname: '/contato',
				search: '',
				simulateHost: 'app',
			}),
		).toBe(`${CANONICAL_SITE_ORIGIN}/contato`)

		expect(
			resolveHostSplitRedirect({
				hostname: 'localhost',
				protocol: 'http',
				pathname: '/',
				search: '',
				simulateHost: 'app',
			}),
		).toBe('http://localhost/planos')

		expect(
			resolveHostSplitRedirect({
				hostname: 'localhost',
				protocol: 'http',
				pathname: '/planos',
				search: '',
				simulateHost: 'app',
			}),
		).toBeNull()

		expect(
			resolveHostSplitRedirect({
				hostname: 'preview.vercel.app',
				protocol: 'https',
				pathname: '/planos',
				search: '',
				simulateHost: 'www',
			}),
		).toBe(`${APP_SITE_ORIGIN}/planos`)

		expect(
			resolveHostSplitRedirect({
				hostname: WWW,
				protocol: 'https',
				pathname: '/',
				search: '',
				simulateHost: 'app',
			}),
		).toBeNull()
	})

	it('does not redirect unrelated hosts', () => {
		expect(
			resolveHostSplitRedirect({
				hostname: 'evolution.conectize.com.br',
				protocol: 'https',
				pathname: '/planos',
				search: '',
			}),
		).toBeNull()
	})
})

describe('hostSplitRedirect status', () => {
	it('uses 301 for GET and HEAD and 308 for other methods', () => {
		expect(
			split({ hostname: WWW, pathname: '/planos', method: 'GET' }),
		).toEqual({
			url: `${APP_SITE_ORIGIN}/planos`,
			status: 301,
		})
		expect(
			split({ hostname: WWW, pathname: '/planos', method: 'HEAD' })?.status,
		).toBe(301)
		expect(
			split({ hostname: APP, pathname: '/contato', method: 'POST' }),
		).toEqual({
			url: `${CANONICAL_SITE_ORIGIN}/contato`,
			status: 308,
		})
		expect(
			split({
				hostname: WWW,
				pathname: '/api/portal/bling/webhook',
				method: 'POST',
			}),
		).toBeNull()
	})
})

describe('appSeoRewritePath', () => {
	it('rewrites only robots and sitemap', () => {
		expect(appSeoRewritePath('/robots.txt')).toBe('/internal/app-robots')
		expect(appSeoRewritePath('/sitemap.xml')).toBe('/internal/app-sitemap')
		expect(appSeoRewritePath('/planos')).toBeNull()
	})
})
