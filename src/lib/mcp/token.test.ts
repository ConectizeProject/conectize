import { describe, expect, it } from 'vitest'
import { evaluateMcpKey } from './access'
import { generateMcpToken, hashMcpToken, tokenHashMatches } from './token'

describe('mcp token', () => {
	it('guarda só o hash, nunca o segredo', () => {
		const { token, tokenHash } = generateMcpToken()
		expect(token.startsWith('czmcp_')).toBe(true)
		expect(tokenHash).toBe(hashMcpToken(token))
		expect(tokenHash).not.toBe(token)
		expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
	})

	it('recusa hash diferente', () => {
		const { tokenHash } = generateMcpToken()
		const other = hashMcpToken('czmcp_outra-chave-que-nao-e-a-original')
		expect(tokenHashMatches(tokenHash, other)).toBe(false)
	})
})

describe('evaluateMcpKey', () => {
	const { token, tokenHash } = generateMcpToken()

	it('aceita chave ativa da organização', () => {
		expect(
			evaluateMcpKey(
				{
					id: 'k1',
					organization_id: 'org-a',
					user_id: 'user-a',
					token_hash: tokenHash,
					revoked_at: null,
				},
				hashMcpToken(token),
			),
		).toBe('ok')
	})

	it('recusa chave revogada', () => {
		expect(
			evaluateMcpKey(
				{
					id: 'k1',
					organization_id: 'org-a',
					user_id: 'user-a',
					token_hash: tokenHash,
					revoked_at: '2026-10-09T00:00:00.000Z',
				},
				tokenHash,
			),
		).toBe('revoked')
	})

	it('recusa chave sem organização', () => {
		expect(
			evaluateMcpKey(
				{
					id: 'k1',
					organization_id: null,
					user_id: 'user-a',
					token_hash: tokenHash,
					revoked_at: null,
				},
				tokenHash,
			),
		).toBe('org_missing')
	})
})
