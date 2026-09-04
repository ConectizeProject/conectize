import { describe, expect, it } from 'vitest'
import { userFromAuthClaims } from './auth-session-resilience'
import { isValidPortalRoleHint } from './portal-role-hint'

describe('userFromAuthClaims', () => {
	it('retorna usuário quando sub está presente', () => {
		expect(userFromAuthClaims({ sub: 'abc', email: 'a@b.com' })).toEqual({
			id: 'abc',
			email: 'a@b.com',
		})
	})

	it('retorna null sem sub', () => {
		expect(userFromAuthClaims({ email: 'a@b.com' })).toBeNull()
	})
})

describe('isValidPortalRoleHint', () => {
	it('aceita papéis conhecidos', () => {
		expect(isValidPortalRoleHint('admin')).toBe(true)
		expect(isValidPortalRoleHint('staff')).toBe(true)
	})

	it('rejeita valores inválidos', () => {
		expect(isValidPortalRoleHint('superuser')).toBe(false)
		expect(isValidPortalRoleHint(null)).toBe(false)
	})
})
