import { NextResponse } from 'next/server'
import { describe, expect, it } from 'vitest'
import { PORTAL_ROLE_HINT_COOKIE } from '@/lib/auth/portal-role-hint'
import { PORTAL_SIMULATED_ROLE_COOKIE } from '@/lib/auth/portal-role-simulation'
import {
	AUTH_COOKIE_PARENT_DOMAIN,
	applyAuthCookieToResponse,
	authCookieDomain,
	browserAuthCookieOptions,
	expireAuthCookieHeaders,
	sharedAuthPromotionHeaders,
	shouldPromoteAuthCookies,
	withSharedAuthCookieDomain,
} from '@/lib/supabase/auth-cookie-domain'

describe('authCookieDomain', () => {
	it('compartilha a sessão só em www, apex e app', () => {
		expect(authCookieDomain('www.conectize.com.br')).toBe(
			AUTH_COOKIE_PARENT_DOMAIN,
		)
		expect(authCookieDomain('conectize.com.br')).toBe(AUTH_COOKIE_PARENT_DOMAIN)
		expect(authCookieDomain('app.conectize.com.br')).toBe(
			AUTH_COOKIE_PARENT_DOMAIN,
		)
		expect(authCookieDomain('APP.conectize.com.br.')).toBe(
			AUTH_COOKIE_PARENT_DOMAIN,
		)
	})

	it('não aplica Domain em localhost, preview ou outro subdomínio', () => {
		expect(authCookieDomain('localhost')).toBeUndefined()
		expect(authCookieDomain('localhost:3000')).toBeUndefined()
		expect(authCookieDomain('127.0.0.1')).toBeUndefined()
		expect(authCookieDomain('conectize-git-preview.vercel.app')).toBeUndefined()
		expect(authCookieDomain('evolution.conectize.com.br')).toBeUndefined()
		expect(authCookieDomain('')).toBeUndefined()
	})
})

describe('withSharedAuthCookieDomain', () => {
	it('marca Domain e Secure nos hosts de produção', () => {
		expect(
			withSharedAuthCookieDomain('app.conectize.com.br', {
				path: '/',
				sameSite: 'lax',
				httpOnly: false,
				secure: false,
			}),
		).toEqual({
			path: '/',
			sameSite: 'lax',
			httpOnly: false,
			secure: true,
			domain: AUTH_COOKIE_PARENT_DOMAIN,
		})
	})

	it('preserva as opções em localhost', () => {
		expect(
			withSharedAuthCookieDomain('localhost', {
				path: '/',
				secure: false,
				sameSite: 'lax',
			}),
		).toEqual({
			path: '/',
			secure: false,
			sameSite: 'lax',
		})
	})
})

describe('browserAuthCookieOptions', () => {
	it('omite Domain fora de produção e exige Secure só em https', () => {
		expect(browserAuthCookieOptions('localhost', 'http:')).toBeUndefined()
		expect(
			browserAuthCookieOptions('preview.vercel.app', 'https:'),
		).toBeUndefined()
		expect(browserAuthCookieOptions('www.conectize.com.br', 'https:')).toEqual({
			domain: AUTH_COOKIE_PARENT_DOMAIN,
			path: '/',
			sameSite: 'lax',
			secure: true,
		})
	})
})

describe('sharedAuthPromotionHeaders', () => {
	it('só promove quando o redirect cruza www, apex e app', () => {
		expect(
			shouldPromoteAuthCookies('www.conectize.com.br', 'app.conectize.com.br'),
		).toBe(true)
		expect(
			shouldPromoteAuthCookies('conectize.com.br', 'www.conectize.com.br'),
		).toBe(true)
		expect(
			shouldPromoteAuthCookies('www.conectize.com.br', 'www.conectize.com.br'),
		).toBe(false)
		expect(shouldPromoteAuthCookies('localhost', 'app.conectize.com.br')).toBe(
			false,
		)
		expect(
			shouldPromoteAuthCookies(
				'www.conectize.com.br',
				'evolution.conectize.com.br',
			),
		).toBe(false)
	})

	it('copia o cookie sb e apaga a cópia host-only, sem cookies alheios', () => {
		const lines = sharedAuthPromotionHeaders([
			{ name: 'sb-ref-auth-token', value: 'jwt' },
			{ name: 'hub_oauth_state', value: 'secret' },
			{ name: PORTAL_ROLE_HINT_COOKIE, value: 'admin' },
			{ name: PORTAL_SIMULATED_ROLE_COOKIE, value: '' },
		])

		expect(lines.some((line) => line.startsWith('hub_oauth_state='))).toBe(
			false,
		)
		expect(
			lines.some((line) => line.startsWith(`${PORTAL_SIMULATED_ROLE_COOKIE}=`)),
		).toBe(false)

		const parent = lines.find(
			(line) =>
				line.startsWith('sb-ref-auth-token=jwt') &&
				line.includes(`Domain=${AUTH_COOKIE_PARENT_DOMAIN}`),
		)
		const clear = lines.find(
			(line) =>
				line.startsWith('sb-ref-auth-token=') &&
				line.includes('Max-Age=0') &&
				!line.includes('Domain='),
		)
		expect(parent).toContain('Secure')
		expect(parent).toContain('SameSite=Lax')
		expect(parent).not.toContain('HttpOnly')
		expect(clear).toBeDefined()

		const role = lines.find((line) =>
			line.startsWith(`${PORTAL_ROLE_HINT_COOKIE}=admin`),
		)
		expect(role).toContain('HttpOnly')
		expect(role).toContain(`Domain=${AUTH_COOKIE_PARENT_DOMAIN}`)
	})
})

describe('applyAuthCookieToResponse', () => {
	it('grava Domain e expira o host-only no redirect de produção', () => {
		const response = NextResponse.redirect(
			'https://app.conectize.com.br/portal',
			301,
		)
		applyAuthCookieToResponse(
			response,
			'www.conectize.com.br',
			'sb-ref-auth-token',
			'jwt',
			{ path: '/', sameSite: 'lax', httpOnly: false },
		)
		const cookies = response.headers.getSetCookie()
		expect(
			cookies.some(
				(line) =>
					line.includes('sb-ref-auth-token=jwt') &&
					line.includes(`Domain=${AUTH_COOKIE_PARENT_DOMAIN}`),
			),
		).toBe(true)
		expect(
			cookies.some(
				(line) =>
					line.startsWith('sb-ref-auth-token=') &&
					line.includes('Max-Age=0') &&
					!line.includes('Domain='),
			),
		).toBe(true)
	})

	it('não força Domain nem Secure em localhost', () => {
		const response = NextResponse.next()
		applyAuthCookieToResponse(
			response,
			'localhost',
			'sb-ref-auth-token',
			'jwt',
			{
				path: '/',
				secure: false,
				sameSite: 'lax',
			},
		)
		const cookies = response.headers.getSetCookie()
		expect(cookies).toHaveLength(1)
		expect(cookies[0]).not.toContain('Domain=')
		expect(cookies[0]).not.toContain('Secure')
	})
})

describe('expireAuthCookieHeaders', () => {
	it('expira as duas cópias em produção e só a do host fora dele', () => {
		const production = expireAuthCookieHeaders(
			'app.conectize.com.br',
			PORTAL_SIMULATED_ROLE_COOKIE,
			{ path: '/', httpOnly: true, sameSite: 'lax', secure: true },
		)
		expect(production).toHaveLength(2)
		expect(production[0]).toContain(`Domain=${AUTH_COOKIE_PARENT_DOMAIN}`)
		expect(production[1]).not.toContain('Domain=')

		const local = expireAuthCookieHeaders(
			'localhost',
			PORTAL_SIMULATED_ROLE_COOKIE,
			{
				path: '/',
				httpOnly: true,
			},
		)
		expect(local).toHaveLength(1)
		expect(local[0]).not.toContain('Domain=')
	})
})
